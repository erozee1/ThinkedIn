import { send } from "../lib/messages";
import { TOKEN_MESSAGE_SOURCE } from "../lib/config";

// Runs on the thinkedin connect page. The page (after Clerk login + minting a
// token) posts the token via window.postMessage; we hand it to the background
// worker, which stores it. This is how the token crosses from the web app into
// the extension without copy-paste.
export default defineContentScript({
  matches: [
    "*://localhost/extension/connect*",
    "https://*.vercel.app/extension/connect*",
  ],
  runAt: "document_start",
  main() {
    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data as { source?: string; token?: string } | null;
      if (!data || data.source !== TOKEN_MESSAGE_SOURCE || typeof data.token !== "string") return;
      send({ type: "TOKEN", token: data.token });
      // Let the page show its "connected" state; the popup will read the token.
    });
  },
});
