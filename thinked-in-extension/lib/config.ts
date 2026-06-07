/**
 * Where the thinkedin backend lives. The extension talks to it over /api/events.
 *
 * Dev: run the thinked-in app locally (`npm run dev` → http://localhost:3000).
 * Prod: set this to your Vercel URL (and make sure host_permissions covers it).
 * Overridable at runtime via chrome.storage ("baseUrl") so you don't have to
 * rebuild to switch environments.
 */
export const DEFAULT_BASE_URL = "http://localhost:3000";

/** Path the popup opens to mint a token (Clerk-authed page in the app). */
export const CONNECT_PATH = "/extension/connect";

export const EVENTS_PATH = "/api/events";

/** postMessage envelope the connect page sends back with the minted token. */
export const TOKEN_MESSAGE_SOURCE = "thinkedin-extension";
