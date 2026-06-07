import { getState, setSettings, setToken, isPaused, type CaptureSettings } from "../../lib/storage";
import { fetchCounts } from "../../lib/api";
import { send } from "../../lib/messages";
import { CONNECT_PATH } from "../../lib/config";

const app = document.getElementById("app")!;
let showSettings = false;

const COG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const LOGOUT = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

async function render(): Promise<void> {
  const state = await getState();

  // ── Logged out ──
  if (!state.token) {
    app.innerHTML = `
      <div class="login">
        <img src="/icon-base.png" alt="thinkedin" />
        <p>Keep your network current as you browse LinkedIn.</p>
        <button class="btn" id="connect">Connect your thinkedin account</button>
      </div>`;
    document.getElementById("connect")!.addEventListener("click", () => {
      chrome.tabs.create({ url: state.baseUrl + CONNECT_PATH });
    });
    return;
  }

  const header = `
    <div class="head">
      <button class="iconbtn" id="cog" title="Settings">${COG}</button>
      <button class="iconbtn danger" id="logout" title="Log out">${LOGOUT}</button>
    </div>`;

  // ── Settings ──
  if (showSettings) {
    const row = (key: keyof CaptureSettings, label: string, note: string) => `
      <div class="toggle-row">
        <div class="name">${label}<small>${note}</small></div>
        <label class="switch">
          <input type="checkbox" data-key="${key}" ${state.settings[key] ? "checked" : ""}/>
          <span class="slider"></span>
        </label>
      </div>`;
    app.innerHTML = `${header}
      <div class="settings">
        <button class="back" id="back">‹ back</button>
        ${row("profiles", "Read profiles", "Freshen connections you view")}
        ${row("connections", "Read connections", "Coming soon")}
        ${row("messages", "Read messages", "Coming soon")}
      </div>`;
    document.getElementById("back")!.addEventListener("click", () => { showSettings = false; render(); });
    app.querySelectorAll<HTMLInputElement>("input[data-key]").forEach((input) => {
      input.addEventListener("change", async () => {
        const next = { ...state.settings, [input.dataset.key as keyof CaptureSettings]: input.checked };
        await setSettings(next);
        send({ type: "SETTINGS_CHANGED" });
      });
    });
    return;
  }

  // ── Main (reading / paused) ──
  const paused = isPaused(state.settings);
  app.innerHTML = `${header}
    <div class="card">
      <div class="status">
        <span class="dot ${paused ? "off" : "on"}"></span>
        <span class="label">${paused ? "Paused" : "Reading"}</span>
      </div>
      <div class="counts">
        <div class="big" id="today">—</div>
        <div class="sub" id="all">—</div>
      </div>
    </div>`;
  document.getElementById("cog")!.addEventListener("click", () => { showSettings = true; render(); });
  document.getElementById("logout")!.addEventListener("click", async () => {
    await setToken(null);
    send({ type: "LOGOUT" });
    showSettings = false;
    render();
  });

  // Counts are best-effort; leave the dashes if the backend is unreachable.
  try {
    const c = await fetchCounts(state.baseUrl, state.token);
    const today = c.today.profiles + c.today.messages;
    const all = c.allTime.profiles + c.allTime.messages;
    document.getElementById("today")!.textContent = `${today} freshened today`;
    document.getElementById("all")!.textContent = `${all} all-time`;
  } catch {
    document.getElementById("today")!.textContent = "Counts unavailable";
    document.getElementById("all")!.textContent = "";
  }
}

// Re-render if the token arrives while the popup is open (connect flow).
chrome.storage.onChanged.addListener(() => render());
render();
