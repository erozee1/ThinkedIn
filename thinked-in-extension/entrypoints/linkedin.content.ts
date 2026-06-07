import type { ProfileViewEvent } from "../shared/events";
import { send } from "../lib/messages";
import { getState } from "../lib/storage";
import { extractProfile } from "../lib/extract";

// READ-ONLY observer. Runs on profile pages the user opens themselves. It never
// fetches anything from LinkedIn and never modifies the page — it just reads the
// profile data LinkedIn already embedded in the page (see lib/extract.ts).
export default defineContentScript({
  matches: ["*://*.linkedin.com/in/*"],
  runAt: "document_idle",
  main() {
    let lastUrl = "";

    const slugOf = (href: string): string | null => {
      const m = href.match(/linkedin\.com\/in\/([^/?#]+)/i);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    };

    // Wait until the profile has actually rendered before reading (up to ~6s).
    async function waitForRender(): Promise<void> {
      for (let i = 0; i < 20; i++) {
        const main = document.querySelector("main") as HTMLElement | null;
        if ((main?.innerText?.length ?? 0) > 200) return;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    async function capture(): Promise<void> {
      const url = location.href;
      const slug = slugOf(url);
      if (!slug) return;

      const { settings, token } = await getState();
      if (!token || !settings.profiles) return;

      await waitForRender();

      // Pull fields from the data LinkedIn embeds in the page (no scrolling).
      const f = extractProfile(slug);

      const event: ProfileViewEvent = {
        kind: "profile_view",
        url,
        observedAt: new Date().toISOString(),
        name: f.name,
        headline: f.headline,
        position: f.position,
        company: f.company,
        publicIdentifier: slug,
        source: f.source,
      };
      send({ type: "CAPTURE", event });
    }

    // Capture on first load and whenever the SPA navigates to a new profile.
    const tick = () => {
      if (location.href !== lastUrl && /linkedin\.com\/in\//i.test(location.href)) {
        lastUrl = location.href;
        capture();
      }
    };
    tick();
    setInterval(tick, 1500);
  },
});
