# NetworkIQ — Full Build Plan for Claude Code

## What We're Building
A multi-tenant web app where users upload their LinkedIn connections CSV, we enrich each profile via Apify, store the data per-user, and provide an AI chat interface powered by Claude where users can query their network naturally.

Example query: "Find me someone who owns a software company in England"

---

## Tech Stack

| Layer | Tool | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack, easy Vercel deploy |
| Auth | Supabase Auth | Built-in, row-level security, free tier |
| Database | Supabase Postgres + pgvector | Stores profiles + embeddings, per-user RLS |
| Embeddings | OpenAI text-embedding-3-small | Fast, cheap, good quality |
| LLM | Anthropic Claude (claude-sonnet-4-20250514) | Query reasoning |
| Enrichment | Apify LinkedIn Profile Scraper | Full profile data inc. location |
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
    /upload/route.ts       ← CSV parsing + Apify enrichment trigger
    /enrich/route.ts       ← Apify polling + embedding + storage
    /chat/route.ts         ← vector search + Claude response
/components
  /UploadZone.tsx
  /ChatInterface.tsx
  /ConnectionsTable.tsx
  /EnrichmentProgress.tsx
/lib
  /supabase.ts             ← supabase client (server + browser)
  /apify.ts                ← apify client wrapper
  /embeddings.ts           ← openai embedding helper
  /claude.ts               ← anthropic client wrapper
/middleware.ts             ← auth protection on /dashboard
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
create index on connections
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for fast user filtering
create index on connections (user_id);

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

# Apify
APIFY_TOKEN=

# OpenAI (embeddings)
OPENAI_API_KEY=

# Anthropic (chat)
ANTHROPIC_API_KEY=
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

## API Routes — Detailed Spec

### POST /api/upload

**What it does:**
1. Receives CSV file from client
2. Parses CSV rows into connection objects
3. Creates an `upload_job` record for progress tracking
4. Inserts all connections as rows with `enrichment_status: 'pending'`
5. Fires off enrichment as a background process (do not await)
6. Returns `{ job_id, total_connections }` immediately so UI can show progress

**CSV columns to parse:**
`First Name, Last Name, Email Address, Company, Position, Connected On, URL`

Note: URL column may or may not be present depending on LinkedIn export version. If absent, construct as `https://linkedin.com/in/[firstname-lastname]` as a best-effort fallback.

**Auth:** Extract `user_id` from Supabase session in request. Attach to every inserted row.

---

### POST /api/enrich

**What it does:**
1. Takes a batch of LinkedIn profile URLs for a given `job_id`
2. Sends them to Apify LinkedIn Profile Scraper actor
3. Polls Apify until run completes
4. For each returned profile:
   - Maps fields to our schema
   - Infers `seniority` from title (see inference logic below)
   - Builds text blob for embedding
   - Calls OpenAI to generate embedding vector
   - Updates connection row with enriched data + embedding
   - Increments `enriched_count` on the upload job
5. Marks job as `complete` when all done

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

### POST /api/chat

**What it does:**
1. Receives `{ message, conversation_history }` from client
2. Calls Claude to extract structured search intent from the message
3. Embeds the semantic query part using OpenAI
4. Runs pgvector similarity search on connections filtered to `user_id`
5. Applies any metadata filters (country, seniority, industry) as SQL WHERE clauses
6. Takes top 20 results
7. Calls Claude again with the results + original question to generate a reasoned response
8. Streams response back to client

**Step 2 — Intent extraction prompt:**
```
Extract search intent from this query as JSON:
{
  "semantic_query": "string to embed for similarity search",
  "filters": {
    "country": "string or null",
    "city": "string or null", 
    "seniority": "founder|c-suite|vp|director|manager|ic or null",
    "industry": "string or null"
  }
}
Query: [user message]
Return only JSON.
```

**Step 4 — Vector search SQL:**
```sql
select *, (embedding <=> '[query_vector]') as distance
from connections
where user_id = '[user_id]'
  and enrichment_status = 'enriched'
  [and country = '...' if filter present]
  [and seniority = '...' if filter present]
order by distance asc
limit 20;
```

**Step 7 — Final Claude prompt:**
```
You are an assistant helping a user search their professional network.
The user asked: "[original question]"

Here are the most relevant connections found:
[connection 1: name, title, company, location, summary]
[connection 2: ...]
...

Respond with:
1. The best matches and why they are relevant
2. Any useful context about each person
3. A suggested intro angle if appropriate

Be specific. Reference actual details from their profiles.
```

**Stream the response** using Vercel AI SDK or a simple ReadableStream.

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
- Drag and drop CSV upload zone (centre of page)
- Helper text: "Export your LinkedIn connections and upload the CSV"
- Link to LinkedIn export page
- Once file dropped: show file name + "Import X connections" button

**State B — Connections exist (check on page load)**
Two-panel layout:
- Left panel (30%): connections summary
  - Total connections count
  - Enriched vs pending count
  - Enrichment progress bar if job is still running (poll `/api/enrich` status)
  - Small scrollable list of enriched connections with name + title + location
- Right panel (70%): chat interface
  - Message history
  - Input box at bottom
  - Streaming response from Claude
  - Each response shows matched connection cards (name, title, company, location)

**Polling enrichment progress:**
While `upload_job.status === 'processing'`, poll Supabase every 3 seconds for updated `enriched_count`. Show "Enriching profiles... 47/312" in the UI. Allow querying immediately on already-enriched connections.

---

## Security Checklist

- All API routes verify the user session before touching data
- `user_id` always comes from the server session, never from the client request body
- `SUPABASE_SERVICE_ROLE_KEY` only used server-side in API routes
- Row Level Security enforced at database level as a second layer
- Never log or store CSV files — parse in memory and discard
- Apify token server-side only

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

1. **Supabase setup** — create project, run schema SQL, enable RLS
2. **Auth** — login, signup, middleware protecting /dashboard
3. **CSV upload + parsing** — upload zone, parse CSV, insert pending rows
4. **Apify enrichment pipeline** — enrich profiles, update rows, mark complete
5. **Embeddings** — generate and store embedding per enriched profile
6. **Chat API** — intent extraction, vector search, Claude response
7. **Dashboard UI** — progress tracking, chat interface, connection cards
8. **Deploy to Vercel**

---

## Notes for Demo

- Pre-enrich a real dataset (dad's connections) before the demo — do not rely on live enrichment during judging
- Have 3-4 impressive queries ready that show off the reasoning quality
- Make sure judges can sign up themselves and upload a small test CSV
- The chat response should always name specific people with specific reasons — generic responses will underimpress
