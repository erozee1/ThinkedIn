import { DEFAULT_BASE_URL } from "./config";

// Thin typed wrapper over chrome.storage.local for the extension's state.

export interface CaptureSettings {
  profiles: boolean;
  connections: boolean;
  messages: boolean;
}

export const DEFAULT_SETTINGS: CaptureSettings = {
  profiles: true,
  connections: false, // wired in a later phase
  messages: false, // wired in a later phase
};

export interface ExtState {
  token: string | null;
  baseUrl: string;
  settings: CaptureSettings;
}

const KEYS = { token: "token", baseUrl: "baseUrl", settings: "settings" } as const;

export async function getState(): Promise<ExtState> {
  const raw = await chrome.storage.local.get([KEYS.token, KEYS.baseUrl, KEYS.settings]);
  return {
    token: (raw[KEYS.token] as string | undefined) ?? null,
    baseUrl: (raw[KEYS.baseUrl] as string | undefined) ?? DEFAULT_BASE_URL,
    settings: { ...DEFAULT_SETTINGS, ...((raw[KEYS.settings] as Partial<CaptureSettings>) ?? {}) },
  };
}

export async function setToken(token: string | null): Promise<void> {
  await chrome.storage.local.set({ [KEYS.token]: token });
}

export async function setSettings(settings: CaptureSettings): Promise<void> {
  await chrome.storage.local.set({ [KEYS.settings]: settings });
}

/** True when every capture channel is off → the extension is paused. */
export const isPaused = (s: CaptureSettings): boolean => !s.profiles && !s.connections && !s.messages;
