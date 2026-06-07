import type { LinkedInEvent } from "../shared/events";

// Runtime messages between content scripts / popup and the background worker.
export type Msg =
  | { type: "CAPTURE"; event: LinkedInEvent } // linkedin content script → background
  | { type: "TOKEN"; token: string } // connect content script → background
  | { type: "SETTINGS_CHANGED" } // popup → background (recompute icon)
  | { type: "LOGOUT" }; // popup → background

export function send(msg: Msg): void {
  // Fire-and-forget; ignore "no receiver" errors when the worker is asleep.
  chrome.runtime.sendMessage(msg).catch(() => {});
}
