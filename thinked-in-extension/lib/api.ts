import { EVENTS_PATH } from "./config";
import type { LinkedInEvent, CaptureCounts } from "../shared/events";

// HTTP client for the thinkedin backend. All calls carry the bearer token.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** POST a batch of observed events. Returns how many freshened a connection. */
export async function sendEvents(
  baseUrl: string,
  token: string,
  events: LinkedInEvent[],
): Promise<{ received: number; freshened: number }> {
  const res = await fetch(baseUrl + EVENTS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new ApiError(res.status, `POST /api/events → ${res.status}`);
  return res.json();
}

/** Fetch today/all-time freshen counts for the popup. */
export async function fetchCounts(baseUrl: string, token: string): Promise<CaptureCounts> {
  const res = await fetch(baseUrl + EVENTS_PATH, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError(res.status, `GET /api/events → ${res.status}`);
  return res.json();
}
