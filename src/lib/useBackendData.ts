import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./http";
import { getToken } from "./backend";

export type BackendData<T> = {
  data: T;
  loading: boolean;
  /** Null while fine; a human-readable reason otherwise. */
  error: string | null;
  /** True only when `data` came from the backend rather than the fallback. */
  isLive: boolean;
  /** True when the request failed purely because nobody is signed in. */
  needsAuth: boolean;
  reload: () => void;
};

/**
 * Fetches a backend resource, falling back to sample data so a page never
 * renders empty when the service is unreachable or the user is in demo mode.
 *
 * Mirrors useCaseGraph's contract: `isLive` lets the UI say which it is showing
 * rather than passing sample data off as real.
 */
export type BackendDataOptions = {
  /**
   * Whether a session token is required before attempting the request.
   *
   * True (default) for backend endpoints, which all 403 without one. False for
   * the AI service, which takes no auth - those requests should be attempted
   * regardless of whether anyone is signed in.
   */
  requireAuth?: boolean;
};

export function useBackendData<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  deps: unknown[] = [],
  options: BackendDataOptions = {},
): BackendData<T> {
  const requireAuth = options.requireAuth !== false;
  const [state, setState] = useState<Omit<BackendData<T>, "reload">>({
    data: fallback,
    loading: true,
    error: null,
    isLive: false,
    needsAuth: false,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    // No token means every protected route would 403 - skip the round trip and
    // say so plainly instead of surfacing a confusing permission error.
    if (requireAuth && !getToken()) {
      setState({ data: fallback, loading: false, error: null, isLive: false, needsAuth: true });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));
    fetcher()
      .then(result => {
        if (cancelled) return;
        setState({ data: result, loading: false, error: null, isLive: true, needsAuth: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : undefined;
        const unauthorised = status === 401 || status === 403;
        setState({
          data: fallback,
          loading: false,
          error: unauthorised ? null : err instanceof Error ? err.message : "Request failed",
          isLive: false,
          needsAuth: unauthorised,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
}
