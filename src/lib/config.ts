// Service endpoints.
//
// In development these are RELATIVE paths that hit the Vite proxy declared in
// vite.config.ts, which forwards to the real services server-side. That is
// deliberate: neither service's CORS allowlist includes this dev server's
// origin, so calling them directly from the browser is blocked. Going through
// the proxy makes every request same-origin, and CORS never applies.
//
// In production the app talks to the services directly, which means the
// deployed frontend's origin MUST be added to both allowlists. See CORS.md.
//
// Setting VITE_AI_SERVICE_URL / VITE_BACKEND_URL overrides both modes - useful
// for pointing at a locally running service.

const explicitAi = import.meta.env.VITE_AI_SERVICE_URL as string | undefined;
const explicitBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;

export const AI_BASE_URL: string =
  explicitAi ?? (import.meta.env.DEV ? "/ai-api" : "https://crimenexa-ai-service.onrender.com");

export const BACKEND_BASE_URL: string =
  explicitBackend ?? (import.meta.env.DEV ? "/be-api" : "https://crimenexa-backend.onrender.com");

// Render's free tier spins instances down after inactivity; the first request
// then pays a cold start of roughly 50 seconds. Anything less than this will
// look like a network failure when the service is merely waking up.
export const REQUEST_TIMEOUT_MS = 120_000;
