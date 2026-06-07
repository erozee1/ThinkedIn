// Shared frontend types for thinkedin.
// `Connection` mirrors the eventual Supabase `connections` schema so the real
// backend can slot in behind the stub /api routes without changing components.

export type Seniority =
  | "founder"
  | "c-suite"
  | "vp"
  | "director"
  | "manager"
  | "ic";

export type EnrichmentStatus = "pending" | "enriched" | "failed";

export interface Connection {
  id: string;
  firstName: string;
  lastName: string;
  /** Convenience full name (firstName + lastName). */
  name: string;
  position: string;
  company: string;
  city: string | null;
  country: string | null;
  /** "City, Country" for display. */
  location: string | null;
  summary: string | null;
  industry: string | null;
  seniority: Seniority;
  skills: string[];
  avatarUrl: string;
  linkedinUrl: string;
  enrichmentStatus: EnrichmentStatus;
}

/** Result of a premium live-verification (Apify re-scrape of the profile). */
export interface ProfileVerification {
  /** match = live role agrees with our record; stale = role changed; unreachable = scrape failed. */
  status: "match" | "stale" | "unreachable";
  /** Fresh title/company pulled from the live profile (null when unreachable). */
  currentPosition: string | null;
  currentCompany: string | null;
  /** ISO timestamp the check ran. */
  checkedAt: string;
}

/** A person card shown in the chat reply / landing demo. */
export type ProfileCardData = Pick<
  Connection,
  "id" | "name" | "position" | "company" | "location" | "avatarUrl" | "linkedinUrl"
> & {
  /** Present only when a premium verify_profiles call re-scraped this person. */
  verified?: ProfileVerification;
  /** True when the connection belongs to an org team member rather than the requesting user. */
  fromTeam?: boolean;
};

export type ChatRole = "user" | "assistant";

/** A drafted post / outreach message the assistant can surface. */
export interface PostData {
  author?: { name: string; role: string; avatarUrl: string };
  title: string;
  body: string;
}

/** Structured info about a single tool call, forwarded from the agent to the client. */
export interface ToolCallInfo {
  name: string;
  input: Record<string, unknown>;
  resultCount: number | null;
  /** True while the tool is still executing; cleared when tool_result arrives. */
  loading?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /**
   * "thinking" = an intermediate tool-call turn (shown as a compact step strip).
   * "answer"   = the final model response (shown as a full chat bubble).
   * Undefined until turn_end is received; treated as "answer" for backwards compat.
   */
  kind?: "thinking" | "answer";
  /** Tools called during this turn — populated for kind="thinking" messages. */
  toolNames?: string[];
  /** Rich tool call details (supersedes toolNames when present). */
  toolCalls?: ToolCallInfo[];
  /** Matched people the assistant surfaced inline with this reply. */
  matches?: ProfileCardData[];
  /** A drafted post/message the assistant surfaced. */
  post?: PostData;
  /** Set while an assistant message is still streaming in. */
  pending?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  /** ISO timestamp of last activity, for sidebar ordering/labels. */
  updatedAt: string;
  messages: ChatMessage[];
}

export interface UploadPreviewPerson {
  name: string;
  detail: string | null;
  initials: string;
}

export interface UploadResponse {
  jobId: string;
  totalConnections: number;
  hasMessagesFile: boolean;
  previewConnections: UploadPreviewPerson[];
}

/** Progress shape returned by the stubbed /api/enrich endpoint. */
export interface EnrichmentProgress {
  jobId: string;
  total: number;
  enrichedCount: number;
  /** 0..1 progress based on imported connection rows. */
  ratio: number;
  status: "processing_connections" | "processing_messages" | "complete" | "failed";
}
