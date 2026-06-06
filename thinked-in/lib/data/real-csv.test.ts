import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseConnections, fullName } from "./connections";
import { parseMessages } from "./messages";
import { aggregateRelationships } from "./relationships";
import type { RelationshipStrength } from "./types";

// The exports live at the repo root, one level above thinked-in/ (vitest cwd).
const CONNECTIONS = resolve(process.cwd(), "..", "Connections.csv");
const MESSAGES = resolve(process.cwd(), "..", "messages.csv");

const hasFixtures = existsSync(CONNECTIONS) && existsSync(MESSAGES);
const d = hasFixtures ? describe : describe.skip;
if (!hasFixtures) {
  // eslint-disable-next-line no-console
  console.warn("[real-csv.test] skipping — Connections.csv / messages.csv not found at repo root");
}

const VALID_STRENGTHS: RelationshipStrength[] = ["none", "dormant", "warm", "active", "close"];

d("real Connections.csv", () => {
  const csv = readFileSync(CONNECTIONS, "utf8");
  const connections = parseConnections(csv);

  it("parses the full connection list past the preamble", () => {
    expect(connections.length).toBeGreaterThan(900);
  });

  it("maps columns by header name (URL is not 3rd-position-dependent)", () => {
    const first = connections[0];
    expect(fullName(first)).toBe("Ilhan Toygan");
    expect(first.linkedinUrl).toContain("ilhantoygan");
  });

  it("every row has at least a name", () => {
    expect(connections.every((c) => c.firstName || c.lastName)).toBe(true);
  });

  it("most connections carry a company and position", () => {
    const withCompany = connections.filter((c) => c.company).length;
    expect(withCompany).toBeGreaterThan(connections.length * 0.7);
  });
});

d("real messages.csv", () => {
  const csv = readFileSync(MESSAGES, "utf8");
  const { owner, messages } = parseMessages(csv);

  it("detects the account owner", () => {
    expect(owner.name).toBe("Afthab Shiraz");
  });

  it("parses messages with a valid direction", () => {
    expect(messages.length).toBeGreaterThan(1400);
    expect(messages.every((m) => m.direction === "sent" || m.direction === "received")).toBe(true);
  });

  it("never lists the owner as their own partner", () => {
    expect(messages.some((m) => m.partnerName === owner.name)).toBe(false);
  });
});

d("relationship aggregation over real data", () => {
  const connections = parseConnections(readFileSync(CONNECTIONS, "utf8"));
  const { messages } = parseMessages(readFileSync(MESSAGES, "utf8"));
  const result = aggregateRelationships(messages, connections, new Date("2026-06-05T00:00:00Z"));

  it("matches some messages to connections by URL", () => {
    expect(result.matchedConnections).toBeGreaterThan(0);
    expect(result.matchedMessages + result.unmatchedMessages).toBe(messages.length);
  });

  it("produces one aggregate per connection, all with a valid (non-null) strength", () => {
    expect(result.perConnection.length).toBe(connections.length);
    expect(result.perConnection.every((a) => VALID_STRENGTHS.includes(a.relationshipStrength))).toBe(true);
  });

  it("backfills 'none' for connections with no messages", () => {
    const noneCount = result.perConnection.filter((a) => a.relationshipStrength === "none").length;
    const withMessages = result.perConnection.filter((a) => a.messageCount > 0).length;
    expect(noneCount).toBe(connections.length - withMessages);
    expect(withMessages).toBe(result.matchedConnections);
  });

  it("message counts never exceed the matched total", () => {
    const sum = result.perConnection.reduce((n, a) => n + a.messageCount, 0);
    expect(sum).toBe(result.matchedMessages);
  });
});
