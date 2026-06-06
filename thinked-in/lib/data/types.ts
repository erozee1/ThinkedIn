// Shared types for the data-processing layer (Phase 1).
// These are pure-data shapes; no DB or auth concerns here.

export type Seniority = "founder" | "c-suite" | "vp" | "director" | "manager" | "ic";

export type RelationshipStrength = "none" | "dormant" | "warm" | "active" | "close";

/** A connection as parsed from LinkedIn's Connections.csv (pre-enrichment). */
export interface RawConnection {
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  position: string | null;
  connectedOn: string | null;
  linkedinUrl: string | null;
}

/** Optional enrichment fields used when building the embedding text blob. */
export interface ProfileLike {
  fullName: string;
  position?: string | null;
  company?: string | null;
  city?: string | null;
  country?: string | null;
  summary?: string | null;
  experience?: { title?: string | null; company?: string | null }[] | null;
  skills?: string[] | null;
  industry?: string | null;
}

export type MessageDirection = "sent" | "received";

/** A single message after we've resolved owner/partner and direction. */
export interface ParsedMessage {
  conversationId: string | null;
  direction: MessageDirection;
  partnerName: string;
  partnerProfileUrl: string | null;
  sentAt: Date | null;
  subject: string | null;
  content: string | null;
}

/** Per-connection relationship aggregate derived from messages. */
export interface RelationshipAggregate {
  messageCount: number;
  sentCount: number;
  receivedCount: number;
  firstContacted: Date | null;
  lastContacted: Date | null;
  relationshipStrength: RelationshipStrength;
}
