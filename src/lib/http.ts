import { REQUEST_TIMEOUT_MS } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Turns a leaked Java exception into something actionable.
 *
 * UploadController returns `"Upload failed: " + e.getMessage()` as a plain
 * string, so an unmapped enum reaches the UI as
 * "No enum constant com.xcom.crimenexa.model.Evidence.DocumentCategory.LOCATION".
 * That reads as a crash; it actually means the running backend predates a
 * category this frontend already offers.
 */
function translateServerError(text: string): string | null {
  // Java reports the fully-qualified name, e.g.
  //   com.xcom.crimenexa.model.Evidence.DocumentCategory.LOCATION
  // so take the last segment as the constant and the one before as the enum.
  const enumMiss = /No enum constant\s+([\w.$]+)/.exec(text);
  if (enumMiss) {
    const parts = enumMiss[1].split(".").filter(Boolean);
    const constant = parts[parts.length - 1];
    const enumName = parts.length > 1 ? parts[parts.length - 2] : "value";
    return `The backend does not recognise "${constant}" as a ${enumName}. ` +
      "That value exists in this frontend but not in the deployed service - it needs the latest backend deployed.";
  }

  // Postgres CHECK-constraint violation, surfaced through Hibernate. Hibernate
  // generates a CHECK listing an enum's values when it first creates the table,
  // and ddl-auto=update never alters an existing constraint - so adding an enum
  // value leaves the database still enforcing the old set.
  const checkViolation = /violates check constraint "([\w.]+)"/i.exec(text);
  if (checkViolation) {
    const rejected = /Failing row contains \([^)]*?\b([A-Z][A-Z0-9_]{2,})\b/.exec(text);
    const value = rejected ? `"${rejected[1]}" ` : "";
    return `The database rejected the value ${value}(constraint ${checkViolation[1]}). ` +
      "The application accepts it but the database schema has not been migrated to match - " +
      "that column's CHECK constraint still lists the previous set of allowed values.";
  }

  // Anything carrying a SQL statement is a leaked server exception. Never render
  // it verbatim: it is unreadable, and it exposes table and column structure.
  if (/\b(insert into|update\s+\w+\s+set|select\s+.+\s+from)\b/i.test(text)) {
    const first = text.split(/\[|;/)[0].trim();
    return (first.length > 10 && first.length < 200 ? first : "The database rejected this request") +
      " (server error details omitted).";
  }

  return null;
}

/** Both services report failures differently, so normalise to one message. */
function messageFor(status: number, body: unknown): string {
  if (typeof body === "string" && body.trim()) {
    return translateServerError(body) ?? body.trim();
  }
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    // Spring: {"error":"Bad Request","message":"password: must not be blank"}
    if (typeof b.message === "string") return translateServerError(b.message) ?? b.message;
    // FastAPI: {"detail":"..."} or {"detail":[{loc,msg,type}]}
    if (typeof b.detail === "string") return b.detail;
    if (Array.isArray(b.detail)) {
      return b.detail
        .map((d) => {
          const v = d as { loc?: unknown[]; msg?: string };
          const where = Array.isArray(v.loc) ? v.loc.slice(1).join(".") : "";
          return where ? `${where}: ${v.msg}` : String(v.msg);
        })
        .join("; ");
    }
  }
  if (status === 502 || status === 503) return "Service is restarting - try again in a minute.";
  return `Request failed (HTTP ${status})`;
}

export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Request timed out - the service may be cold starting.");
    }
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  } finally {
    clearTimeout(timer);
  }

  // Read as text first: error responses are not always JSON. A crashed uvicorn
  // worker returns a bare "Internal Server Error", and Render's 502 is HTML.
  const text = await res.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } else {
    body = null;
  }

  if (!res.ok) throw new ApiError(res.status, messageFor(res.status, body), body);
  return body as T;
}

/**
 * Multipart upload with real progress.
 *
 * fetch() cannot report upload progress - there is no equivalent of
 * XHR's upload.onprogress - so this drops to XMLHttpRequest deliberately.
 * Everything else in this module should use request().
 */
export function uploadWithProgress<T>(
  url: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  headers: Record<string, string> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    // Never set Content-Type here - the browser must add the multipart boundary.
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let body: unknown = xhr.responseText;
      if (xhr.responseText) {
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = xhr.responseText;
        }
      } else {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(xhr.status, messageFor(xhr.status, body), body));
    };

    xhr.onerror = () => reject(new ApiError(0, "Network error - could not reach the service."));
    xhr.ontimeout = () => reject(new ApiError(0, "Upload timed out - the service may be cold starting."));

    xhr.send(form);
  });
}

export function jsonPost<T>(url: string, payload: unknown, headers: Record<string, string> = {}): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}
