import type { LinkedInEvent } from "../shared/events";
import type { Msg } from "../lib/messages";
import { getState, setToken, isPaused } from "../lib/storage";
import { sendEvents } from "../lib/api";

// The brain: holds the token, batches captured events, POSTs them, and reflects
// status on the toolbar icon (green = reading, red = error, grey = paused).

type IconState = "reading" | "error" | "paused";

export default defineBackground(() => {
  let queue: LinkedInEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let lastError = false;

  // ── Toolbar icon ──────────────────────────────────────────────────────────
  async function paintIcon(state: IconState): Promise<void> {
    // Primary: composite the base icon + a status glyph via OffscreenCanvas.
    try {
      const size = 32;
      const url = chrome.runtime.getURL("icon-base.png");
      const bmp = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d")!;
      ctx.filter = state === "paused" ? "grayscale(1) opacity(0.55)" : "none";
      ctx.drawImage(bmp, 0, 0, size, size);
      ctx.filter = "none";

      if (state !== "paused") {
        const r = 9;
        const cx = size - r + 1;
        const cy = size - r + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = state === "reading" ? "#22c55e" : "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (state === "reading") {
          ctx.moveTo(cx - 4, cy);
          ctx.lineTo(cx - 1, cy + 3);
          ctx.lineTo(cx + 4, cy - 3);
        } else {
          ctx.moveTo(cx - 3, cy - 3);
          ctx.lineTo(cx + 3, cy + 3);
          ctx.moveTo(cx + 3, cy - 3);
          ctx.lineTo(cx - 3, cy + 3);
        }
        ctx.stroke();
      }
      const imageData = ctx.getImageData(0, 0, size, size);
      await chrome.action.setIcon({ imageData });
      await chrome.action.setBadgeText({ text: "" });
    } catch {
      // Fallback: a colored badge so state is still visible.
      const map = { reading: ["✓", "#22c55e"], error: ["!", "#ef4444"], paused: ["", "#9ca3af"] } as const;
      const [text, color] = map[state];
      await chrome.action.setBadgeBackgroundColor({ color });
      await chrome.action.setBadgeText({ text });
    }
  }

  async function refreshIcon(): Promise<void> {
    const { settings, token } = await getState();
    if (isPaused(settings) || !token) return void paintIcon("paused");
    paintIcon(lastError ? "error" : "reading");
  }

  // ── Event batching ──────────────────────────────────────────────────────────
  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 2000);
  }

  async function flush(): Promise<void> {
    flushTimer = null;
    if (!queue.length) return;
    const { token, baseUrl, settings } = await getState();
    if (!token || isPaused(settings)) {
      queue = [];
      return;
    }
    const batch = queue;
    queue = [];
    try {
      await sendEvents(baseUrl, token, batch);
      lastError = false;
    } catch {
      lastError = true;
      // Drop the batch (best-effort capture); surface the error on the icon.
    }
    refreshIcon();
  }

  // ── Wiring ───────────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg: Msg) => {
    if (msg.type === "CAPTURE") {
      queue.push(msg.event);
      scheduleFlush();
    } else if (msg.type === "TOKEN") {
      setToken(msg.token).then(refreshIcon);
    } else if (msg.type === "SETTINGS_CHANGED") {
      refreshIcon();
    } else if (msg.type === "LOGOUT") {
      setToken(null).then(refreshIcon);
    }
  });

  chrome.runtime.onInstalled.addListener(refreshIcon);
  chrome.runtime.onStartup.addListener(refreshIcon);
  refreshIcon();
});
