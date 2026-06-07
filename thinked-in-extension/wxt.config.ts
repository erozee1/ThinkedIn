import { defineConfig } from "wxt";

// MV3 config. The extension is observation-only: it reads pages the user
// already loaded and POSTs events to the thinkedin backend. No prefetch, no
// actions on LinkedIn's behalf.
export default defineConfig({
  manifest: {
    name: "thinkedin — network freshener",
    description: "Keeps your thinkedin network current as you browse LinkedIn.",
    permissions: ["storage", "tabs"],
    // Backend origins the background worker may call, + the connect page, + LinkedIn.
    host_permissions: [
      "*://*.linkedin.com/*",
      "http://localhost/*",
      "https://*.vercel.app/*",
    ],
    action: {
      default_title: "thinkedin",
      default_popup: "popup.html",
    },
    icons: {
      "16": "icon-base.png",
      "32": "icon-base.png",
      "48": "icon-base.png",
      "128": "icon-base.png",
    },
  },
});
