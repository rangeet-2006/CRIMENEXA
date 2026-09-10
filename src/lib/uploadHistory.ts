// Session-scoped record of what has been uploaded.
//
// The Upload page unmounts whenever the user navigates elsewhere, so its queue
// state is lost on every page change - and on reload. The backend cannot fill
// the gap: it exposes no endpoint to list Evidence rows, so there is no server
// history to read back.
//
// sessionStorage rather than localStorage is deliberate. "Session" is the right
// scope for this - it survives navigation and reload but clears when the tab
// closes - and these are evidence filenames tied to a live case, which should
// not linger on disk after the investigator closes the browser.

// Keys are scoped per account. An unscoped key leaked one officer's evidence
// filenames to whoever signed in next in the same tab, because sessionStorage
// outlives a logout.
const KEY_PREFIX = "crimenexa.uploadHistory";
const LEGACY_KEY = "crimenexa.uploadHistory";
const MAX_ENTRIES = 25;

function keyFor(scope: string): string {
  return `${KEY_PREFIX}.${scope || "anon"}`;
}

export type UploadStatus = "uploading" | "done" | "error" | "interrupted";

export type UploadRecord = {
  id: number;
  name: string;
  size: string;
  /** Display label of the document category, e.g. "Call Records". */
  cat: string;
  progress: number;
  status: UploadStatus;
  message: string;
  /** Epoch ms, so the list can show how long ago each upload happened. */
  at: number;
};

function isRecord(value: unknown): value is UploadRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === "number" && typeof r.name === "string" && typeof r.status === "string";
}

export function loadUploadHistory(scope: string): UploadRecord[] {
  let raw: string | null = null;
  try {
    // Older builds wrote a single unscoped key. Drop it rather than read it -
    // it may belong to a different account entirely.
    sessionStorage.removeItem(LEGACY_KEY);
    raw = sessionStorage.getItem(keyFor(scope));
  } catch {
    // Private browsing or blocked storage - behave as if there is no history.
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isRecord).map((r) => {
    // An entry still marked "uploading" was in flight when the page went away.
    // The request died with it, but the server may already have stored the
    // file - so report it as interrupted rather than claiming success or
    // failure we cannot verify.
    if (r.status === "uploading") {
      return {
        ...r,
        progress: 100,
        status: "interrupted" as const,
        message: "Interrupted - the page changed before this finished, so whether it was stored is unknown. Re-upload to be certain.",
      };
    }
    return r;
  });
}

export function saveUploadHistory(scope: string, records: UploadRecord[]): void {
  try {
    sessionStorage.setItem(keyFor(scope), JSON.stringify(records.slice(-MAX_ENTRIES)));
  } catch {
    // Storage full or unavailable - the in-memory list still works for this view.
  }
}

/**
 * Remove every account's upload history from this tab.
 *
 * Called on logout. Scoping alone is not enough: the previous account's records
 * would still sit in sessionStorage, readable by anything running in the tab,
 * until it was closed. These are evidence filenames tied to a live case, so
 * they should not outlive the session that created them.
 */
export function clearAllUploadHistory(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) doomed.push(key);
    }
    doomed.forEach(key => sessionStorage.removeItem(key));
  } catch {
    /* nothing to do */
  }
}

/** Highest id seen, so a restored list does not collide with new uploads. */
export function highestId(records: UploadRecord[]): number {
  return records.reduce((max, r) => (r.id > max ? r.id : max), 0);
}
