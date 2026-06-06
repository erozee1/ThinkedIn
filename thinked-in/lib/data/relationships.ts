import { normalizeLinkedInUrl } from "./url";
import type {
  ParsedMessage,
  RawConnection,
  RelationshipAggregate,
  RelationshipStrength,
} from "./types";

const DAY_MS = 86_400_000;

// Ordered weakest -> strongest; a bidirectional thread bumps one level up.
const LEVELS: RelationshipStrength[] = ["dormant", "warm", "active", "close"];

function baseLevel(messageCount: number, daysSinceLast: number): RelationshipStrength {
  if (daysSinceLast <= 90 && messageCount >= 10) return "close";
  if (daysSinceLast <= 90) return "active";
  if (daysSinceLast <= 365) return "warm";
  return "dormant";
}

interface MutAgg {
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  firstContacted: Date | null;
  lastContacted: Date | null;
}

export function relationshipStrength(agg: MutAgg, now: Date): RelationshipStrength {
  if (agg.messageCount === 0) return "none";
  if (!agg.lastContacted) return "dormant";
  const days = (now.getTime() - agg.lastContacted.getTime()) / DAY_MS;
  let level = LEVELS.indexOf(baseLevel(agg.messageCount, days));
  const bidirectional = agg.sentCount > 0 && agg.receivedCount > 0;
  if (bidirectional) level = Math.min(LEVELS.length - 1, level + 1);
  return LEVELS[level];
}

export interface AggregateResult {
  /** One aggregate per connection, index-aligned with the input connections array. */
  perConnection: RelationshipAggregate[];
  matchedMessages: number;
  unmatchedMessages: number;
  matchedConnections: number;
}

/**
 * Match messages to connections by normalized profile URL and roll up per-connection
 * relationship aggregates. Connections with no messages are backfilled to 'none' so
 * the strength field is never null (mirrors build_plan.md step 4).
 */
export function aggregateRelationships(
  messages: ParsedMessage[],
  connections: RawConnection[],
  now: Date = new Date(),
): AggregateResult {
  const urlToIdx = new Map<string, number>();
  connections.forEach((c, i) => {
    const n = normalizeLinkedInUrl(c.linkedinUrl);
    if (n && !urlToIdx.has(n)) urlToIdx.set(n, i);
  });

  const aggs = new Map<number, MutAgg>();
  let matched = 0;
  let unmatched = 0;

  for (const m of messages) {
    const n = normalizeLinkedInUrl(m.partnerProfileUrl);
    const idx = n ? urlToIdx.get(n) : undefined;
    if (idx === undefined) {
      unmatched++;
      continue;
    }
    matched++;

    let a = aggs.get(idx);
    if (!a) {
      a = { messageCount: 0, sentCount: 0, receivedCount: 0, firstContacted: null, lastContacted: null };
      aggs.set(idx, a);
    }
    a.messageCount++;
    if (m.direction === "sent") a.sentCount++;
    else a.receivedCount++;
    if (m.sentAt) {
      if (!a.firstContacted || m.sentAt < a.firstContacted) a.firstContacted = m.sentAt;
      if (!a.lastContacted || m.sentAt > a.lastContacted) a.lastContacted = m.sentAt;
    }
  }

  const perConnection: RelationshipAggregate[] = connections.map((_c, i) => {
    const a = aggs.get(i);
    if (!a) {
      return {
        messageCount: 0,
        sentCount: 0,
        receivedCount: 0,
        firstContacted: null,
        lastContacted: null,
        relationshipStrength: "none",
      };
    }
    return {
      messageCount: a.messageCount,
      sentCount: a.sentCount,
      receivedCount: a.receivedCount,
      firstContacted: a.firstContacted,
      lastContacted: a.lastContacted,
      relationshipStrength: relationshipStrength(a, now),
    };
  });

  return {
    perConnection,
    matchedMessages: matched,
    unmatchedMessages: unmatched,
    matchedConnections: aggs.size,
  };
}
