# NetworkIQ — Full Build Plan for Claude Code

## What We're Building
A multi-tenant web app where users upload **two** LinkedIn exports — their `Connections.csv`
and their `messages.csv` — and we build a queryable model of their professional network. We
enrich each connection's profile via Apify, derive **relationship signal** from the message
history (who they actually talk to, how recently, how often, about what), store everything
per-user, and provide an AI chat interface powered by Claude where users query their network
naturally.

Connections tell us **who someone is**. Messages tell us **how well the user knows them** —
that relationship layer is the most valuable signal in a *personal* network, so it is part
of the baseline, not an add-on.

Example queries:
- "Find me someone who owns a software company in England" *(profile match)*
- "Who do I actually have a relationship with at a big tech company?" *(profile + relationship)*
- "Who have I talked to about fundraising that I've gone quiet with?" *(message topic + recency)*

And on any one person, a **live deep dive** sends a research sub-agent out to the open web in
real time — posts, websites, news, recent activity — to turn a static profile into a live
briefing with a personalized intro angle (see "Live Deep Dive" below).

### Privacy — messages are opt-down by design
Message history is more sensitive than a public connection list, so consent is **tiered and
explicit**, captured at upload. The user picks one of:

| Mode | What we store | What it enables |
|---|---|---|
| **`full`** | Relationship metadata **+ message subjects/content** (embedded) | Everything, incl. "who did I talk to about X" |
| **`metadata`** *(default when a messages file is provided)* | Only who/when/how-many (counts, first/last contact, direction) — **no subjects, no content** | Relationship strength & recency, but not topic search |
| **`none`** (full opt-out) | Nothing — `messages.csv` is parsed in memory and discarded, never written | Profiles only; the app works exactly as if no messages existed |

Messages are a **baseline part of the product** (the relationship layer is built in, not an
add-on), but the **default consent is privacy-preserving**: we use *who/when* by default and
only ingest *content* if the user explicitly upgrades to `full`. The DB column defaults to
`none` until the user makes a choice. The whole system **degrades gracefully** — message-backed
tools are only registered for the agent when the user's mode allows them, the agent is told
which data it does and doesn't have, and a user can change mode or **purge all message data**
at any time.

---

## Tech Stack

| Layer | Tool | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack, easy Vercel deploy |
| Auth | Supabase Auth | Built-in, row-level security, free tier |
| Database | Supabase Postgres + pgvector | Stores profiles + embeddings, per-user RLS |
| Embeddings | OpenAI text-embedding-3-small | Fast, cheap, good quality |
| LLM | Anthropic Claude (`claude-sonnet-4-6`; `claude-opus-4-8` for best tool reasoning) | Query reasoning |
| Enrichment | Apify LinkedIn Profile Scraper | Full profile data inc. location |
| Live posts | Apify LinkedIn Posts/Activity Scraper (separate actor) | Recent posts for the deep dive |
| Styling | Tailwind CSS | Fast to build |
| Deploy | Vercel | One command, free tier |

---

## Project Structure

```
/app
  /auth
    /login/page.tsx
    /signup/page.tsx
    /callback/route.ts
  /dashboard
    /page.tsx              ← main app (upload + chat)
  /api
    /upload/route.ts       ← CSV parsing (connections + messages) + consent + enrichment trigger
    /enrich/route.ts       ← Apify polling + embedding + storage
    /messages/route.ts     ← update consent mode / purge all message data
    /chat/route.ts         ← agent tools (profiles + messages) + Claude response
    /deep-dive/route.ts    ← live per-profile research sub-agent (streams a briefing)
/components
  /UploadZone.tsx          ← drops BOTH csvs (connections required, messages optional)
  /MessagesConsent.tsx     ← tiered consent picker (full / metadata / none) shown at upload
  /ChatInterface.tsx
  /ConnectionsTable.tsx
  /EnrichmentProgress.tsx
  /PrivacyControls.tsx     ← change message mode / purge messages
  /DeepDivePanel.tsx       ← "Deep dive" button + streaming live-research briefing
/lib
  /supabase.ts             ← supabase client (server + browser)
  /apify.ts                ← apify wrapper: scrapeProfile() [enrichment] + scrapeActivity() [deep dive] — two actors
  /embeddings.ts           ← openai embedding helper
  /claude.ts               ← anthropic client wrapper
  /relationships.ts        ← match messages→connections + derive relationship aggregates
  /research.ts             ← deep-dive sub-agent: web search + url fetch + linkedin activity
/middleware.ts             ← auth protection on /dashboard
/scripts
  /enrich.ts               ← OFFLINE pre-enrichment (Path A): connections.csv → apify → embed → supabase
  /ingest-messages.ts      ← OFFLINE: messages.csv → match to connections → aggregate → (embed) → supabase
```

---

## Database Schema

### Run these in Supabase SQL editor

```sql
-- Enable pgvector
create extension if not exists vector;

-- Connections table (one row per connection per user)
create table connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- From CSV
  first_name text,
  last_name text,
  email text,
  company text,
  position text,
  connected_on text,
  linkedin_url text,
  
  -- From Apify enrichment
  location text,
  country text,
  city text,
  summary text,
  experience jsonb,
  education jsonb,
  skills text[],
  industry text,
  seniority text,         -- inferred: founder / c-suite / director / manager / ic
  enriched_at timestamptz,
  enrichment_status text default 'pending', -- pending / enriched / failed

  -- Normalized for reliable filtering (see "filters must be fuzzy" note below).
  -- Raw location/company stay above; these lowercase/canonical copies are what filters hit.
  country_norm text,      -- e.g. 'united kingdom' (England/Scotland/Wales/UK all map here)
  company_norm text,      -- lowercased, suffix-stripped ('google llc' -> 'google')

  -- Relationship signal derived from messages.csv (NULL if user mode = 'none',
  -- and content-derived fields stay NULL if mode = 'metadata'). Populated by
  -- scripts/ingest-messages.ts. These let the agent reason about how well the
  -- user actually knows each person, not just who they are.
  message_count int default 0,
  sent_count int default 0,
  received_count int default 0,
  first_contacted timestamptz,
  last_contacted timestamptz,
  relationship_strength text,  -- inferred: close / active / warm / dormant / none

  -- Embedding of full profile text blob
  embedding vector(1536),

  created_at timestamptz default now()
);

-- Row Level Security — users can only see their own connections
alter table connections enable row level security;

create policy "Users can only access own connections"
  on connections for all
  using (auth.uid() = user_id);

-- Index for fast vector search
-- Use HNSW (not ivfflat). HNSW needs no list tuning and gives better recall
-- on the small per-user datasets we have here (hundreds of rows, not millions).
-- At this scale brute-force is also fine, but HNSW future-proofs it.
create index on connections
  using hnsw (embedding vector_cosine_ops);

-- Index for fast user filtering
create index on connections (user_id);

-- Indexes for the relationship + normalized filters
create index on connections (user_id, relationship_strength);
create index on connections (user_id, last_contacted desc);
create index on connections (user_id, country_norm);
create index on connections (user_id, company_norm);

-- ── Per-user consent / settings ───────────────────────────────────────────────
-- One row per user. messages_mode is the privacy control: it gates BOTH what we
-- ingest and which agent tools get registered. Default 'none' = privacy-safe until
-- the user actively chooses otherwise at upload.
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages_mode text not null default 'none',   -- 'full' | 'metadata' | 'none'
  messages_ingested_at timestamptz,
  consent_recorded_at timestamptz,              -- when the user made the choice
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "Users can only access own settings"
  on user_settings for all
  using (auth.uid() = user_id);

-- ── Messages ──────────────────────────────────────────────────────────────────
-- Raw-ish message rows. ONLY written when messages_mode = 'full'. In 'metadata'
-- mode we compute the per-connection aggregates above and DO NOT insert rows here
-- (no subjects, no content ever touch the DB). In 'none' mode this stays empty.
create table messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references connections(id) on delete set null, -- matched partner (nullable)
  conversation_id text,
  direction text,                 -- 'sent' | 'received'
  partner_name text,
  partner_profile_url text,
  sent_at timestamptz,
  subject text,
  content text,
  embedding vector(1536),         -- embedding of subject+content, for topic search
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy "Users can only access own messages"
  on messages for all
  using (auth.uid() = user_id);

create index on messages using hnsw (embedding vector_cosine_ops);
create index on messages (user_id);
create index on messages (user_id, connection_id);

-- ── Deep-dive research cache ──────────────────────────────────────────────────
-- One row per (user, connection) holding the latest live-research briefing so
-- repeat views are instant and re-runs are explicit. fetched_at drives freshness.
create table profile_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references connections(id) on delete cascade not null,
  briefing jsonb,          -- structured result: summary, recent_activity[], signals[], intro_angle
  sources jsonb,           -- [{title, url, kind}] every claim is backed by one of these
  fetched_at timestamptz default now(),
  unique (user_id, connection_id)
);
alter table profile_research enable row level security;
create policy "Users can only access own research"
  on profile_research for all
  using (auth.uid() = user_id);
create index on profile_research (user_id, connection_id);

-- Upload jobs table (tracks enrichment progress)
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  total_connections int,
  enriched_count int default 0,
  status text default 'processing', -- processing / complete / failed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table upload_jobs enable row level security;

create policy "Users can only access own jobs"
  on upload_jobs for all
  using (auth.uid() = user_id);
```

---

## Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only, never expose to client

# Apify (two actors: one for profile enrichment, one for live post/activity scraping)
APIFY_TOKEN=
APIFY_ACTIVITY_ACTOR=             # LinkedIn posts/activity scraper used by the deep dive

# OpenAI (embeddings)
OPENAI_API_KEY=

# Anthropic (chat)
ANTHROPIC_API_KEY=

# Web search for live deep dives (pick one: Tavily / Serper / Brave)
SEARCH_API_KEY=
```

---

## Auth Flow

Use Supabase Auth with email/password. No OAuth needed for hackathon.

**middleware.ts** — protect all `/dashboard` routes:
```
If no session → redirect to /auth/login
If session exists → allow through
```

**Key detail:** Always use the Supabase server client (not browser client) in API routes and pass the `SUPABASE_SERVICE_ROLE_KEY` only server-side. Never expose the service role key to the browser.

---

## Enrichment Architecture — IMPORTANT

> **Why this section exists:** Vercel serverless functions are killed the moment they
> return their HTTP response. You **cannot** "fire and forget" a background promise — any
> un-awaited work dies. And you cannot poll Apify until a multi-minute scrape finishes —
> the function will hit its execution timeout. Enrichment must be **event-driven**.

We support **two paths**. Use the offline path for the demo; the webhook path is the
"real" production design.

### Path A (recommended for the hackathon demo) — Offline pre-enrichment script

Enrichment never runs as a live API route. Instead a local Node script enriches a CSV
once and writes the rows (with embeddings) straight into Supabase. The deployed app then
only does upload → store → chat, so the fragile part never runs during judging.

`scripts/enrich.ts` (run with `npx tsx scripts/enrich.ts dad-connections.csv <user_id>`):
1. Parse the CSV (skip LinkedIn's preamble — see CSV note below).
2. Start one Apify run with all profile URLs (batched ≤50 per run).
3. `await apifyClient.run(...).waitForFinish()` — fine here, it's a local script with no timeout.
4. For each returned profile: map fields → infer seniority → build text blob → embed → upsert row with `enrichment_status: 'enriched'`.
5. Print progress to console.

This uses the `SUPABASE_SERVICE_ROLE_KEY` locally and sets `user_id` explicitly per row.

While mapping each profile, also write the **normalized filter columns**:
- `country_norm`: lowercase + canonicalise the Apify location. Map England / Scotland / Wales /
  "Greater London" / "UK" → `united kingdom`, etc. Keep the raw `location`/`country` too.
- `company_norm`: lowercase, strip legal suffixes (`llc`, `ltd`, `inc`, `gmbh`) and country
  qualifiers (`google uk` → `google`).

These exist because the agent's filters must be reliable — see **"Filters must be fuzzy"** below.

### Message ingest (Path A) — `scripts/ingest-messages.ts`

> Run with `npx tsx scripts/ingest-messages.ts messages.csv <user_id> <mode>` where
> `<mode>` is `full` or `metadata`. If the user chose `none`, this script is never run and
> nothing is stored.

`messages.csv` columns:
`CONVERSATION ID, CONVERSATION TITLE, FROM, SENDER PROFILE URL, TO, RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT, FOLDER, ATTACHMENTS`

Steps:
1. Parse the CSV. The **owner** (the user) is the constant name across FROM/TO; the **partner**
   is the other side. Derive `direction` = `sent` if FROM == owner else `received`.
2. **Match each message to a connection** by normalised profile URL: lowercase, strip
   `https://`, `www.`, trailing slash, and query string, then match the partner's profile URL
   against `connections.linkedin_url` (normalised the same way). Unmatched partners (e.g.
   "LinkedIn Member" with no URL) keep `connection_id = NULL`; in `full` mode their messages are
   still stored, but they contribute no per-connection relationship aggregate (nothing to attach to).
3. **Always compute per-connection aggregates** (both `full` and `metadata` modes): update the
   matched `connections` row with `message_count`, `sent_count`, `received_count`,
   `first_contacted`, `last_contacted`, and derived `relationship_strength` (see logic below).
   Unmatched partners (no connection row) are dropped from aggregates; their messages still
   exist in `full` mode with `connection_id = NULL`.
4. **Backfill** `relationship_strength = 'none'` for every remaining connection that got no
   messages, so the column is never NULL (group-by stats and `relationship_strength='none'`
   filters behave correctly):
   `update connections set relationship_strength='none'
    where user_id='[user_id]' and relationship_strength is null;`
5. **Only in `full` mode**: also insert a `messages` row per message, embed `subject + content`
   via OpenAI, and store the vector. In `metadata` mode, **skip** content entirely — never embed
   or store subjects/content.
6. Set `user_settings.messages_ingested_at = now()`.

**Relationship strength inference (per connection):**
```
no messages                                              → 'none'
last_contacted within 90d AND message_count >= 10        → 'close'
last_contacted within 90d                                → 'active'
last_contacted within 365d                               → 'warm'
older than 365d                                          → 'dormant'
```
(Bidirectional threads — both sent_count and received_count > 0 — bump one level: a real
back-and-forth signals a stronger tie than one-directional outreach.)

> **Note — message content density:** in this dataset ~1,420 of ~1,540 messages carry real
> content across ~210 partners, so topic search in `full` mode has genuine signal; relationship
> aggregates are reliable even where content is sparse.

### Path B (production) — Apify webhook, no polling

```
/api/upload  → insert pending rows + upload_job, then START an Apify run
               configured with a webhook → /api/enrich. Return immediately.
Apify        → runs the scrape (minutes), then CALLS BACK /api/enrich when done.
/api/enrich  → receives the finished dataset, maps + embeds + stores. No polling,
               no long-running function.
```

This keeps every function call short and within timeout. Progress is tracked in
`upload_jobs` and read by the client directly from Supabase (no status endpoint needed).

---

## API Routes — Detailed Spec

### POST /api/upload

**What it does:**
1. Receives the connections CSV (required), optionally the messages CSV, and the chosen
   `messages_mode` (`full` | `metadata` | `none`) from the client.
2. **Records consent first:** upsert `user_settings` with `messages_mode` and
   `consent_recorded_at = now()`. This is the gate for everything that follows.
3. Parses connection rows into objects (skip LinkedIn preamble — see note).
4. Creates an `upload_job` record for progress tracking.
5. Inserts all connections as rows with `enrichment_status: 'pending'`.
6. **Messages:**
   - If `messages_mode === 'none'`: **discard the messages CSV in memory, never parse or store it.**
   - If `'metadata'`: parse + match + aggregate onto connection rows **inline** — no external
     calls, so it fits the function timeout even for a few thousand messages.
   - If `'full'`: aggregation is inline, but **embedding hundreds–thousands of messages will
     exceed the function timeout — it cannot run synchronously in the request.** Defer it: enqueue
     the embed+store work (e.g. Vercel Queue / a background task) and return immediately, or use
     the offline `ingest-messages.ts` script (Path A). **For the hackathon, live judge uploads
     should be limited to `metadata`/`none`; `full` is pre-loaded on the demo account offline.**
7. **Path B only (connections):** starts an Apify run (≤50 URLs/run) with a webhook pointing at
   `/api/enrich?job_id=...`. Does **not** await the run.
8. Returns `{ job_id, total_connections, messages_mode }` immediately so the UI can show progress.

**Connections CSV columns to parse:**
`First Name, Last Name, Email Address, Company, Position, Connected On, URL`

**Messages CSV columns to parse:**
`CONVERSATION ID, CONVERSATION TITLE, FROM, SENDER PROFILE URL, TO, RECIPIENT PROFILE URLS, DATE, SUBJECT, CONTENT, FOLDER, ATTACHMENTS`

**CSV note (LinkedIn export gotcha):** LinkedIn's `Connections.csv` begins with a 2–3 line
"Notes:" preamble *before* the real header row. The parser **must skip lines until it
finds the row starting with `First Name`**, or every import fails. The `URL` column may be
absent on some export versions; if so, fall back to `https://linkedin.com/in/[firstname-lastname]`.

**Auth:** Extract `user_id` from Supabase session in request. Attach to every inserted row.

---

### POST /api/messages  (consent + privacy controls)

Lets the user change their mind after the initial upload. Two actions (`{ action }` in body):

- **`action: 'set_mode'`** with `mode: 'full' | 'metadata' | 'none'` — updates
  `user_settings.messages_mode`. Downgrading is destructive and applied immediately:
  - `full → metadata`: delete all rows in `messages` (drops content + embeddings); keep the
    aggregate columns on `connections`.
  - `* → none`: delete all `messages` rows **and** null out every relationship column on
    `connections` (`message_count`, `*_count`, `first/last_contacted`, `relationship_strength`).
  - Upgrading (e.g. `none → full`) requires re-uploading the messages CSV; we never retain it.
- **`action: 'purge'`** — hard reset to `none`: delete everything message-derived as above.
  This is the "forget my messages" button.

**Auth:** `user_id` from session only; run under the user-JWT client so RLS applies. Never
accept a `user_id` from the body.

---

### POST /api/enrich  (Path B — Apify webhook receiver)

**What it does:**
1. Triggered by Apify's webhook when a scrape run **finishes** (not called by our own code).
2. Reads the finished run's dataset items (the scraped profiles) for the `job_id`.
3. For each returned profile:
   - Maps fields to our schema
   - Infers `seniority` from title (see inference logic below)
   - Builds text blob for embedding
   - Calls OpenAI to generate embedding vector
   - Updates the matching connection row (by linkedin_url + user_id) with enriched data + embedding
   - Increments `enriched_count` on the upload job
4. Marks job as `complete` when `enriched_count == total_connections`.

There is **no polling loop** — the function runs once per finished Apify run and returns quickly.

**Webhook security:** Verify the request actually came from Apify (shared secret in the
webhook URL / header). Treat the body as untrusted.

**Apify actor to use:** `curious_coder/linkedin-profile-scraper`

**Seniority inference logic:**
```
title contains (founder, co-founder, owner, ceo, president) → "founder"
title contains (cto, cfo, coo, cpo, ciso, c-suite) → "c-suite"  
title contains (vp, vice president, svp, evp) → "vp"
title contains (director, head of) → "director"
title contains (manager, lead) → "manager"
else → "ic"
```

**Text blob for embedding (per connection):**
```
[Full Name], [position] at [company].
Location: [city], [country].
About: [summary].
Experience: [job1 title] at [job1 company], [job2 title] at [job2 company].
Skills: [skill1], [skill2], [skill3].
Industry: [industry].
```

**Batch size:** Send Apify max 50 URLs per run to keep runs fast and manageable.

---

### POST /api/chat  — Tool-based agent (reasons over the WHOLE network)

**Core idea:** Don't hard-code a single vector search. Instead give Claude a set of
**tools** for querying the database and let it pick the right one(s) per question. This is
what lets the agent reason over the *entire* network, not just the 20 nearest rows.

The toolset spans two layers — **who people are** (profiles) and **how well the user knows
them** (relationships, from messages):

- *"Find me someone who owns a software company in England"* → `search_by_meaning`.
- *"Who actually knows people at big tech?"* → `query_by_filter` with a relationship filter.
- *"How many founders do I know?"* → `query_by_filter` (a real `count` over **all** rows).
- *"Summarize my network"* → `get_network_stats` (aggregates across **all** rows).
- *"Who have I talked to about fundraising?"* → `search_messages` *(full mode only)*.

**Tools are registered per the user's `messages_mode`** — this is how privacy is enforced at
the agent layer:

| `messages_mode` | profile tools | relationship filters/stats | `search_messages` |
|---|---|---|---|
| `full` | ✅ | ✅ | ✅ |
| `metadata` | ✅ | ✅ | ❌ (not registered) |
| `none` | ✅ | ❌ (relationship fields are NULL) | ❌ |

The agent loop:
1. Receive `{ message, conversation_history }`; read `user_settings.messages_mode`.
2. Build the toolset for that mode and send the message to Claude **with those tools defined**.
3. Claude decides which tool(s) to call and with what arguments.
4. We execute the tool against Supabase (scoped to `user_id`), return the result to Claude.
5. Claude may call another tool or write its final answer. Repeat until it answers.
6. Stream the final answer back to the client.

> Use the **Vercel AI SDK** (`streamText` + `tools` with `maxSteps` / multi-step) or the
> Anthropic SDK tool-use loop. The SDK handles the call → execute → continue cycle for you.

---

### The most important behaviour: reason about WHO fits, then search

Users won't ask in database terms. They'll ask things like:
- *"Who could fulfil this end of a deal where someone is selling bricks?"*
- *"Find me people who can give me referrals for big tech."*
- *"Who could help me raise a seed round?"*

The literal words ("bricks", "referrals") are **not** what's in anyone's profile. The agent
must first **translate the goal into the profile of the person who would fit**, and search
for *that* — never embed the user's raw sentence.

**This is the single most important rule in the system prompt.** Concretely:

1. **Infer the ideal-candidate profile.** "Selling bricks" → the user wants a *buyer* of
   bricks → construction companies, property developers, building contractors, builders'
   merchants, civil-engineering firms. The agent passes *that* description to
   `search_by_meaning` (HyDE-style: describe the person you're hoping to find, then embed
   that description — its fingerprint lands near real matching profiles).

2. **Decompose into concrete filters where possible.** "Big tech referrals" → people who
   *work at* big tech → `query_by_filter` / `search_by_meaning` filtered to
   `company IN (Google, Meta, Amazon, Apple, Microsoft, Netflix, Nvidia…)`. The agent
   should expand fuzzy categories ("big tech", "FAANG", "enterprise SaaS") into concrete
   company/industry sets itself.

3. **Run multiple searches and merge.** A good answer for "who could buy bricks" may need
   2–3 searches ("property developers", "construction firm owners", "builders merchants").
   The agent can call `search_by_meaning` several times before answering — `maxSteps`
   allows this.

4. **Over-fetch, then judge.** Pull a wider net (`limit: 40`) and let Claude *read* the
   candidates and decide which genuinely fit, discarding poor matches and explaining the
   reasoning. Vector distance gets you close; Claude's judgement does the final ranking.

So `search_by_meaning`'s `query` argument is **Claude's description of the ideal person**,
authored after reasoning about the goal — not the user's original message.

---

**The tools** (profile layer: always on · relationship layer: gated by `messages_mode`)

**`search_by_meaning`** — fuzzy "find me someone like…" search.
```
args: {
  query: string,
  filters?: {
    country, city, seniority, industry, company,   // profile (always available)
    relationship_strength, min_message_count       // relationship (gated; messages_mode != 'none')
  },
  limit?: number
}
does: embed `query` with OpenAI → pgvector similarity search → return top N rows, INCLUDING
      relationship_strength + last_contacted so the agent can weight by tie strength.
use when: the user describes a *kind* of person, OR a goal that implies a kind of person.
note: `query` is the AGENT'S description of the ideal candidate (e.g. "owner of a
      construction or property development company that buys building materials"), NOT the
      user's literal words ("selling bricks"). Filters are FUZZY — see "Filters must be fuzzy".
```
SQL it runs:
```sql
select first_name, last_name, position, company, location, country,
       seniority, industry, summary, linkedin_url,
       relationship_strength, last_contacted,
       (embedding <=> '[query_vector]') as distance
from connections
where user_id = '[user_id]'
  and enrichment_status = 'enriched'
  [and country_norm = lower('[mapped country]')             if country provided]
  [and company_norm ilike '%' || lower('[company]') || '%'  if company provided]
  [and seniority = '...'                                     if provided]
  [and industry ilike '%...%'                                if provided]
  [and relationship_strength = '...'                         if provided]
  [and message_count >= N                                    if provided]
order by distance asc
limit [limit or 20];
```

**`query_by_filter`** — exact lookups, lists, and **counts over the whole network**.
```
args: {
  filters: {
    country, city, seniority, industry, company,         // profile (always available)
    relationship_strength,                               // close|active|warm|dormant  (gated)
    last_contacted_after,                                // ISO date                   (gated)
    min_message_count                                    // int                        (gated)
  },
  mode: 'count' | 'list', limit?: number
}
does: plain SQL with WHERE clauses. mode='count' returns an exact number across ALL rows.
      country/company filters hit the NORMALIZED columns with fuzzy matching (see note).
      relationship_* filters are only offered when messages_mode != 'none'.
use when: the user asks "how many…", "list all…", "who works at X", "who do I know well at Y".
```
SQL it runs (count mode):
```sql
select count(*) from connections
where user_id = '[user_id]'
  -- enrichment is required ONLY when filtering on enriched profile fields (country/company/
  -- industry/seniority). For pure RELATIONSHIP queries (reconnect, message_count, etc.) DROP
  -- this predicate — relationship data is independent of enrichment. See note below.
  [and enrichment_status = 'enriched'             if any profile filter is used]
  [and country_norm = lower('[mapped country]')   if country provided]
  [and company_norm ilike '%' || lower('[company]') || '%'  if company provided]
  [and seniority = '...'                           if provided]
  [and relationship_strength = '...'              if provided]
  [and last_contacted >= '...'                    if provided]
  [and message_count >= N                         if provided];
```

**`get_network_stats`** — the "reason over everything" tool.
```
args: { group_by?: 'industry' | 'country' | 'seniority' | 'relationship_strength' }
does: aggregate across ALL the user's rows and return summary numbers, not raw profiles.
      group_by='relationship_strength' only offered when messages_mode != 'none'.
      ALSO returns a coverage line (total / enriched / pending / failed) so the agent can
      honestly caveat partial enrichment instead of guessing.
use when: the user asks to "summarize my network", "what industries am I strong in",
          "how much of my network do I actually keep in touch with", etc.
```
SQL it runs:
```sql
-- coverage (always returned)
select count(*) total,
       count(*) filter (where enrichment_status='enriched') enriched,
       count(*) filter (where enrichment_status='pending')  pending,
       count(*) filter (where enrichment_status='failed')   failed
from connections where user_id = '[user_id]';

-- the grouping
select coalesce([group_by], 'none') as bucket, count(*) as n
from connections
where user_id = '[user_id]'
  -- profile groupings only count enriched rows; relationship_strength counts ALL rows
  -- (it comes from messages, not enrichment).
  [and enrichment_status = 'enriched'   when group_by != 'relationship_strength']
group by bucket
order by n desc;
```
This is how the agent "sees" all 900+ people without us stuffing 900 profiles into the
prompt: it reasons over the **shape** (counts per group) instead of the raw text.

---

**`keyword_search`** — lexical fallback over profile text. *(always available)*
```
args: { terms: string[], fields?: ('position'|'company'|'summary'|'skills')[], limit?: number }
does: case-insensitive ILIKE / full-text match across the named profile fields for ANY term.
use when: the goal hinges on a SPECIFIC word that vector search might bury past the limit
          (a niche skill, a named tool, an exact title). Complements search_by_meaning —
          run both and merge for vague queries with a concrete keyword.
```
SQL it runs:
```sql
select first_name, last_name, position, company, location, country, seniority,
       industry, summary, linkedin_url, relationship_strength, last_contacted
from connections
where user_id = '[user_id]' and enrichment_status = 'enriched'
  and ( position ilike '%term%' or company ilike '%term%'
        or summary ilike '%term%' or array_to_string(skills,' ') ilike '%term%' )  -- per term, OR'd
limit [limit or 40];
```

**`search_messages`** — semantic search over conversation history.
**Only registered when `messages_mode = 'full'`.**
```
args: { query: string, limit?: number }
does: embed `query` → pgvector similarity over the messages table → return matching
      messages WITH the connection they're with (join messages.connection_id → connections).
returns: snippets + who + when, so the agent can answer "who did I discuss X with" and
         "what did we last say". Always pair results with relationship recency.
use when: the question is about what was DISCUSSED or said, not just who someone is.
note: like search_by_meaning, `query` is the agent's description of the TOPIC to find,
      not necessarily the user's literal words.
```
SQL it runs:
```sql
select m.subject, m.content, m.direction, m.sent_at,
       c.first_name, c.last_name, c.company, c.linkedin_url,
       (m.embedding <=> '[query_vector]') as distance
from messages m
left join connections c on c.id = m.connection_id
where m.user_id = '[user_id]'
order by distance asc
limit [limit or 20];
```

---

**Filters must be fuzzy — read this:** LinkedIn/Apify data is messy, so **exact** `=` filters
silently return zero rows and the agent looks broken. Two rules:
- Filters hit the **normalized** columns (`country_norm`, `company_norm`) populated at ingest,
  and use `ilike`/canonical mapping — never raw `=` on `country`/`company`. (The flagship query
  "software company **in England**" fails with `country = 'England'` because profiles say
  "United Kingdom"; `country_norm = 'united kingdom'` is what makes it work.)
- The system prompt instructs the agent: **if a filtered search returns empty, relax the
  filter and retry** (drop the geo/company constraint, or fall back to `search_by_meaning`)
  before concluding "no one matches."

**Relationship ≠ enrichment — read this:** the relationship layer (message_count,
last_contacted, relationship_strength) is derived from messages and is **independent of Apify
enrichment**. So a *pure* relationship query ("who should I reconnect with?", "who do I message
most?") must **not** filter on `enrichment_status = 'enriched'`, or you'll silently exclude
people the user genuinely knows whose profile scrape failed or is still pending. Only require
`enriched` when the query actually filters on an enriched profile field. Note: `search_by_meaning`
inherently needs the embedding (so it only sees enriched rows) — route pure relationship lookups
to `query_by_filter`, not semantic search.

**RLS gotcha — read this:** Execute every tool through a Supabase client created with the
**user's JWT** (from their session), **not** the `SUPABASE_SERVICE_ROLE_KEY`. The service
role key **bypasses Row Level Security**, so a bug in a `WHERE user_id = ...` clause would
leak other users' connections **or messages**. Let RLS be the real guardrail; keep the
explicit `user_id` filter as defense-in-depth. (For the vector + group-by queries on both
`connections` and `messages`, wrap them in Postgres functions via `rpc()` so they still run
under the user's RLS context.)

**System prompt for the agent:** (the `{{MESSAGES_CAPABILITY}}` block is injected per the
user's `messages_mode` — see the three variants below the prompt)
```
You are an assistant that helps a user explore and reason over their professional network.
You have two kinds of knowledge about each person: WHO THEY ARE (their profile) and HOW WELL
THE USER KNOWS THEM (relationship signal derived from message history).

{{MESSAGES_CAPABILITY}}

MOST IMPORTANT RULE — reason about WHO fits before you search:
The user states a goal, often abstractly ("who could buy bricks", "referrals for big tech",
"help me raise a seed round"). The literal words are NOT what appears in profiles. First
work out the PROFILE of the person who would fit, then search for that:
  - "someone selling bricks" → they need a BUYER → owners of construction / property
    development / building firms, builders' merchants. Search for those.
  - "referrals for big tech" → people who WORK AT big tech → filter company to
    Google, Meta, Amazon, Apple, Microsoft, Netflix, Nvidia, etc.
Expand fuzzy categories (big tech, FAANG, enterprise SaaS) into concrete companies/industries
yourself. The `query` you pass to search_by_meaning must be YOUR description of the ideal
candidate, never the user's raw sentence.

Choose tools deliberately:
- To FIND people who fit a goal or description, use search_by_meaning (over-fetch with a
  larger limit, then judge which actually fit). Call it multiple times with different angles
  if one search won't cover the goal.
- If the goal hinges on a SPECIFIC word (a niche skill, a named tool, an exact title), also
  run keyword_search and merge — vector search can bury an exact match past the limit.
- To COUNT or LIST people by exact attributes, use query_by_filter.
- To SUMMARIZE or describe the shape of the whole network, use get_network_stats.

Filters are fuzzy on purpose, but can still come back empty. If a filtered query returns
nothing, RELAX it (drop the location/company constraint, or switch to search_by_meaning) and
retry before telling the user no one matches. Never report "no results" after a single
constrained attempt.

Weigh the relationship, not just the fit: a perfect-on-paper stranger the user has never
messaged is often less useful than a slightly-weaker match they actually talk to. When you
have relationship signal, prefer warmer ties and say how warm each is ("you last spoke 2
months ago"). When asked to "reconnect", surface strong-but-dormant ties.

You may call multiple tools before answering. Never guess numbers — if the user asks
"how many", call a tool to get the real count.

When you answer:
- Be specific. Reference actual names, titles, companies, and locations from the data.
- Explain WHY each person fits the goal (not just that they matched) and suggest an intro angle.
- Note the relationship where you have it (close / active / warm / dormant, recency).
- If a match is weak, say so honestly rather than overselling it.
- For counts/summaries, give the real figures, and caveat coverage if enrichment is partial.
```

**`{{MESSAGES_CAPABILITY}}` variants** (inject the one matching the user's mode):
```
full:     You also have the user's message history. Use search_messages to find who they
          discussed a topic with, and relationship filters/stats (relationship_strength,
          last_contacted) to reason about tie strength. Treat message content as private —
          quote only briefly and only to the user themselves.
metadata: You know HOW OFTEN and HOW RECENTLY the user spoke with each person (relationship
          strength + recency), but NOT what was said. Use relationship filters/stats. You
          cannot search conversation topics; if asked, say that requires enabling message
          content.
none:     The user has not shared message history. You only know profiles. If asked about
          relationships, recency, or "who do I talk to", explain that enabling messages would
          let you answer, and fall back to profile-based reasoning.
```

**Model choice:** Use **`claude-sonnet-4-6`** for the agent loop (upgrade to **`claude-opus-4-8`**
if tool-selection quality matters more than latency/cost — the deep-dive sub-agent in particular
benefits). Embeddings still go through OpenAI inside `search_by_meaning`.

**Stream the final response** using the Vercel AI SDK (`streamText`) or a `ReadableStream`.

---

**Example flows**

| User asks | How the agent reasons → tool call | Needs messages? |
|---|---|---|
| "Someone who owns a software company in England" | direct → `search_by_meaning("software company founder/owner", {country:'England'→united kingdom})` | No |
| "Who could buy the bricks I'm selling?" | bricks → needs a buyer → `search_by_meaning("owner of construction / property development / building firm", {limit:40})`, maybe a 2nd search for "builders' merchants" | No |
| "Find me people who can give referrals for big tech" | big tech → works at FAANG → `query_by_filter({company:'Google'},'list')` etc., or `search_by_meaning("engineer/employee at a major tech company")` | No |
| "How many founders do I know?" | count → `query_by_filter({seniority:'founder'}, 'count')` | No |
| "What industries am I strongest in?" | shape → `get_network_stats({group_by:'industry'})` | No |
| "Who do I actually KNOW at a big tech company?" | fit + tie → `query_by_filter({company:'…', relationship_strength:'close'})` or filter search results to warm ties | metadata+ |
| "Who have I talked to about fundraising?" | topic → `search_messages("raising a round, investors, seed funding")` → join to connections | **full** |
| "Who should I reconnect with?" | strong but stale → `query_by_filter({relationship_strength:'dormant', min_message_count:5}, 'list')` | metadata+ |
| "How much of my network do I keep in touch with?" | shape → `get_network_stats({group_by:'relationship_strength'})` | metadata+ |
| "Who could help me raise a seed round, that I already know?" | investors + warm → `search_by_meaning("angel investor / VC / founder who has raised")` then prefer high relationship_strength | metadata+ |

---

## Live Deep Dive — per-profile research sub-agent

**What it is:** when the user focuses on one person — clicks a connection card, or asks the
chat agent to "tell me more about X" — they can trigger a **live deep dive**. A research
sub-agent goes out to the open web *right now*, reads what this person has been doing recently,
and streams back a briefing with a personalized intro angle. This is what makes the product
feel **alive** instead of a static directory: the stored profile is who they were at enrichment
time; the deep dive is who they are today.

**Why it matters:** it introduces a *recurring, per-contact* job — pre-outreach research —
that the base network search doesn't have. It's the natural bridge from "find the person" to
"actually reach out", and it keeps the data fresh on demand.

### POST /api/deep-dive

```
args: { connection_id, force_refresh?: boolean }
```
1. Load the connection (RLS, user-JWT) + any relationship/message context the user's mode allows.
2. If a `profile_research` row exists and is fresh (`fetched_at` within ~24h) and `!force_refresh`,
   return it immediately. Otherwise run the sub-agent.
3. Run the **research loop** (Claude Sonnet + the tools below), streaming progress to the client.
4. Persist the structured result to `profile_research` (upsert on `user_id, connection_id`).
5. Stream the final briefing.

### The research sub-agent

A scoped agent loop with a **step budget** (≤6 tool calls) and a **fixed output schema** so it
stays focused and fast. Its tools:

**`web_search`** — `{ query }` → web results (news, Crunchbase, podcasts, GitHub, X, press).
Run several angles: `"<name> <company>"`, `"<name> founder"`, `"<company> funding"`, etc.

**`fetch_url`** — `{ url }` → fetch + extract readable content from a page. Use on the person's
personal site, their company site, an article about them, their GitHub, etc. (the stored
`linkedin_url`, company, and search hits give the starting URLs).

**`scrape_linkedin_activity`** — `{ linkedin_url }` → recent posts/comments/reactions. Reveals
what they're publicly talking about and caring about *now*.
> **Separate Apify actor:** this is a **different** scraper from the one used for enrichment.
> Enrichment uses the *profile* scraper (`curious_coder/linkedin-profile-scraper`); the deep
> dive uses a dedicated **LinkedIn posts/activity scraper** actor. `lib/apify.ts` should expose
> two calls — `scrapeProfile(url)` and `scrapeActivity(url)` — pointing at the two actors. Set
> the activity actor id in env (`APIFY_ACTIVITY_ACTOR`). Unlike enrichment, this runs **live**
> at deep-dive time, not in the offline batch.

The sub-agent **fuses** these with the internal context (their stored profile + the user's own
message history with them, when permitted) into one briefing.

### Output schema (the briefing)

```json
{
  "summary": "2–3 sentence who-they-are-now",
  "recent_activity": [{ "what": "...", "when": "...", "source_url": "..." }],
  "signals": ["raised a seed round in March", "hiring backend engineers", "speaking at X"],
  "mutual_context": "what YOU and they have discussed / how warm the tie is (mode-permitting)",
  "intro_angle": "a specific, personalized opener grounded in the above",
  "sources": [{ "title": "...", "url": "...", "kind": "news|site|linkedin|github" }]
}
```

### Rules for the sub-agent (system prompt essentials)

```
You research one person live and produce a briefing to help the user reach out well.
- CITE EVERYTHING. Every claim in recent_activity/signals must map to a source URL. If you
  cannot find something, say so — NEVER invent activity, jobs, funding, or quotes.
- Prefer recent, specific, verifiable facts over generic bio filler.
- Fuse external findings with the user's own context (shared messages, relationship recency)
  to make the intro_angle personal, not generic.
- Stay within your step budget; return the schema even if some fields are empty.
- PRIVACY: never send the user's private message content (or any other connection's data) to
  web_search or scrape_linkedin_activity. Only the target's PUBLIC identifiers — name, company,
  linkedin_url — may go to external tools. Private context is used only inside your own
  reasoning to shape mutual_context / intro_angle, never transmitted outward.
```

> **Enforce it in code, not just the prompt:** the `web_search` / `scrape_linkedin_activity`
> tool wrappers should only ever receive the target's public fields. Build their arguments
> server-side from `{name, company, linkedin_url}` rather than letting the model pass free-form
> strings that could contain private message text.

### Streaming UX

The latency is a **feature** — narrate the work as it happens so it feels alive:
`Searching the web for Jane Doe… reading holonomy.io… checking recent LinkedIn posts… found a
seed round announcement…` then render the briefing with source links and a copy-able intro
draft. `force_refresh` re-runs on demand; otherwise cached results load instantly.

---

## Frontend — Page Specs

### /auth/login and /auth/signup
Standard email/password forms using Supabase Auth client.
After signup → redirect to `/dashboard`.
After login → redirect to `/dashboard`.

---

### /dashboard

Two states managed by React state:

**State A — No connections uploaded yet**
- Drag and drop upload zone (centre of page) accepting **two** files:
  - `Connections.csv` — **required**
  - `messages.csv` — **optional**
- Helper text: "Export your LinkedIn connections (and, optionally, your messages) and upload the CSVs"
- Link to LinkedIn export page
- **Messages consent picker (`MessagesConsent.tsx`)** — shown only when a messages file is
  added. A clear, plain-language radio choice, defaulting to **`metadata`** (relationship
  insight without exposing content), with the other options one click away:
  - **Full** — "Use my messages, including what was said, so I can ask what I discussed with people."
  - **Relationship only** *(default)* — "Use only who I spoke to and when — never the words."
  - **Skip messages** — "Don't use my messages at all."
  - Microcopy: "Your messages are private to your account, never shared, and you can delete
    them anytime." Choosing Full shows a one-line note that subjects/content are embedded for search.
- Once files dropped: show file name(s) + chosen mode + "Import X connections" button.

**State B — Connections exist (check on page load)**
Two-panel layout:
- Left panel (30%): connections summary
  - Total connections count
  - Enriched vs pending count
  - **Messages status:** current mode badge (Full / Relationship only / Off) + `PrivacyControls.tsx`
    to change mode or **"Forget my messages"** (calls `POST /api/messages`).
  - If `messages_mode != 'none'`: a tiny relationship breakdown (close / active / warm / dormant counts)
  - Enrichment progress bar if job is still running (poll the `upload_jobs` row directly)
  - Small scrollable list of enriched connections with name + title + location (+ relationship
    chip & "last spoke" when available)
- Right panel (70%): chat interface
  - Message history
  - Input box at bottom
  - Streaming response from Claude
  - Each response shows matched connection cards (name, title, company, location, and a
    relationship chip — "Active · last spoke 3w ago" — when messages are enabled)
  - Every connection card has a **"Deep dive"** button → opens `DeepDivePanel.tsx`, which calls
    `POST /api/deep-dive` and streams the live briefing (recent activity, signals, source links,
    copy-able intro draft) with a "Refresh" control for `force_refresh`

**Polling enrichment progress:**
While `upload_job.status === 'processing'`, poll the `upload_jobs` row in Supabase directly
(via the RLS'd browser client) every 3 seconds for updated `enriched_count`. Show
"Enriching profiles... 47/312" in the UI. Allow querying immediately on already-enriched
connections. (With Path A offline enrichment, the job is already `complete` on first load,
so this just renders the final state.)

---

## Security Checklist

- All API routes verify the user session before touching data
- `user_id` always comes from the server session, never from the client request body
- `SUPABASE_SERVICE_ROLE_KEY` only used server-side in API routes
- Row Level Security enforced at database level as a second layer (connections **and messages**)
- Never log or store CSV files — parse in memory and discard
- Apify token server-side only

**Message privacy (the confidential layer):**
- Default consent is `metadata` (no content); `full` requires an explicit user choice.
- `messages_mode = 'none'` ⇒ the messages CSV is **never parsed or written** — discarded in memory.
- `messages_mode = 'metadata'` ⇒ **no subjects or content** ever hit the DB or OpenAI; only
  who/when/counts are stored.
- Downgrading mode or "Forget my messages" **hard-deletes** message rows (and nulls relationship
  columns for `none`) immediately.
- `search_messages` and relationship tools are **not registered** for the agent unless the
  user's mode permits them — privacy is enforced server-side, not just in the prompt.
- Message content is embedded via OpenAI only in `full` mode; disclose this in the consent copy.

---

## Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Add all env vars in Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

Supabase is already hosted. No additional infrastructure needed.

---

## Build Order

Do these in sequence. Each step produces something demoable.

1. **Supabase setup** — create project, run schema SQL (connections + messages + user_settings, HNSW indexes), enable RLS on all three.
2. **Auth** — login, signup, middleware protecting /dashboard
3. **Offline enrichment script (Path A)** — `scripts/enrich.ts`: parse CSV (skip preamble) → Apify → infer seniority → **write normalized country/company** → embed → upsert. Run it once on your dad's CSV so you have real demo data immediately. This de-risks everything else.
4. **Message ingest (Path A)** — `scripts/ingest-messages.ts`: parse `messages.csv` → match to connections by normalized URL → compute relationship aggregates → (in `full`) embed + store message rows → derive `relationship_strength`. Run in `full` on your own data so relationship queries demo well.
5. **Chat agent API** — define the tools (`search_by_meaning`, `query_by_filter`, `get_network_stats`, `keyword_search`, and `search_messages` gated by mode), **register them per `messages_mode`**, run the Claude (Sonnet) tool-use loop via the **user-JWT** client, stream the answer. Test the example flows (profile + relationship + topic) against data from steps 3–4. This is the core of the product.
6. **Dashboard UI** — connection summary, messages-mode badge + privacy controls, relationship chips, chat interface, streaming, connection cards
7. **CSV upload + consent + parsing** — upload zone for both CSVs, `MessagesConsent` picker, record consent, parse + insert (live import for judges' own test CSVs)
8. **Privacy controls** — `POST /api/messages` set_mode / purge, wired to `PrivacyControls.tsx`
9. **Live deep dive** — `POST /api/deep-dive` research sub-agent (web_search + fetch_url + scrape_linkedin_activity), cite-everything output schema, `profile_research` cache, streaming `DeepDivePanel`. Big demo "wow" — turns a profile into a live briefing.
10. **Webhook enrichment (Path B, optional)** — `/api/upload` starts Apify run with webhook → `/api/enrich` receiver. Only attempt if earlier steps are solid; the demo doesn't depend on it.
11. **Deploy to Vercel**

---

## Notes for Demo

- Pre-enrich a real dataset (dad's connections) **and pre-ingest messages in `full` mode** before the demo — do not rely on live enrichment during judging
- Have 3-4 impressive queries ready that show off the reasoning quality — include at least one **relationship** query ("who should I reconnect with?") and one **topic** query ("who did I talk to about X?") since those are the differentiator over a plain profile search
- Show the **privacy story** explicitly: demo the consent picker and the "Forget my messages" control — judges care that confidential data is opt-down and deletable
- Make sure judges can sign up themselves and upload a small test CSV (and try each consent mode)
- The chat response should always name specific people with specific reasons (and the relationship where known) — generic responses will underimpress
