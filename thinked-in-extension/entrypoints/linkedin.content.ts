import type { ProfileViewEvent } from "../shared/events";
import { send } from "../lib/messages";
import { getState } from "../lib/storage";

// READ-ONLY observer. Runs on profile pages the user opens themselves. It never
// fetches anything from LinkedIn and never modifies the page — it just reads the
// rendered top card and reports the current title/company.
export default defineContentScript({
  matches: ["*://*.linkedin.com/in/*"],
  runAt: "document_idle",
  main() {
    let lastUrl = "";

    const text = (sel: string): string | null => {
      const el = document.querySelector(sel);
      const t = el?.textContent?.trim();
      return t && t.length ? t : null;
    };

    const slugOf = (href: string): string | null => {
      const m = href.match(/linkedin\.com\/in\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    };

    async function capture(): Promise<void> {
      const url = location.href;
      const slug = slugOf(url);
      if (!slug) return;

      const { settings, token } = await getState();
      if (!token || !settings.profiles) return;

      // Top-card name + headline are the most stable signals.
      const name = text("main h1") ?? text("h1");
      const headline = text("main .text-body-medium.break-words") ?? text(".text-body-medium.break-words");
      // Current role: the top-card experience button, when present.
      const position = text('[data-field="experience_company_logo"] ~ * span[aria-hidden="true"]');
      const company = text('button[aria-label*="Current company"] span[aria-hidden="true"]');

      const event: ProfileViewEvent = {
        kind: "profile_view",
        url,
        observedAt: new Date().toISOString(),
        name,
        headline,
        position,
        company,
        publicIdentifier: slug,
      };
      send({ type: "CAPTURE", event });
    }

    // Capture on first load and whenever the SPA navigates to a new profile.
    const tick = () => {
      if (location.href !== lastUrl && /linkedin\.com\/in\//i.test(location.href)) {
        lastUrl = location.href;
        // Let the new profile's top card render before reading.
        setTimeout(capture, 1200);
      }
    };
    tick();
    setInterval(tick, 1500);
  },
});
