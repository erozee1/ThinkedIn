import { track } from "@vercel/analytics";

export function trackSignUp() {
  track("Sign Up");
}

export function trackChatMessage() {
  track("Chat Message");
}

export function trackNetworkImport() {
  track("Network Import");
}
