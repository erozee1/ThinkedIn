-- NetworkIQ schema — Clerk + Supabase RLS.
-- user_id is Clerk's user id (text, e.g. 'user_2abc...'), NOT a Supabase auth uuid.
-- RLS scopes every row by the Clerk subject claim: auth.jwt() ->> 'sub'.
-- Prereq: configure Clerk as a Supabase third-party auth provider, then run this.

create extension if not exists vector;

-- ── Connections (one row per connection per user) ─────────────────────────────
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,

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
  seniority text,                         -- founder / c-suite / vp / director / manager / ic
  enriched_at timestamptz,
  enrichment_status text default 'pending', -- pending / enriched / failed

  -- Normalized for reliable fuzzy filtering
  country_norm text,
  company_norm text,

  -- Relationship signal derived from messages (independent of enrichment)
  message_count int default 0,
  sent_count int default 0,
  received_count int default 0,
  first_contacted timestamptz,
  last_contacted timestamptz,
  relationship_strength text,             -- none / dormant / warm / active / close

  embedding vector(1536),                 -- text-embedding-3-small
  created_at timestamptz default now()
);

alter table connections enable row level security;
drop policy if exists "own connections" on connections;
create policy "own connections" on connections for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create index if not exists connections_embedding_idx on connections using hnsw (embedding vector_cosine_ops);
create index if not exists connections_user_idx on connections (user_id);
create index if not exists connections_user_rel_idx on connections (user_id, relationship_strength);
create index if not exists connections_user_lastcontact_idx on connections (user_id, last_contacted desc);
create index if not exists connections_user_country_idx on connections (user_id, country_norm);
create index if not exists connections_user_company_idx on connections (user_id, company_norm);

-- ── Per-user consent / settings ───────────────────────────────────────────────
create table if not exists user_settings (
  user_id text primary key,
  messages_mode text not null default 'none',  -- full / metadata / none
  messages_ingested_at timestamptz,
  consent_recorded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;
drop policy if exists "own settings" on user_settings;
create policy "own settings" on user_settings for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- ── Messages (only written when messages_mode = 'full') ───────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  connection_id uuid references connections(id) on delete set null,
  conversation_id text,
  direction text,                 -- sent / received
  partner_name text,
  partner_profile_url text,
  sent_at timestamptz,
  subject text,
  content text,
  embedding vector(1536),
  created_at timestamptz default now()
);

alter table messages enable row level security;
drop policy if exists "own messages" on messages;
create policy "own messages" on messages for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create index if not exists messages_embedding_idx on messages using hnsw (embedding vector_cosine_ops);
create index if not exists messages_user_idx on messages (user_id);
create index if not exists messages_user_conn_idx on messages (user_id, connection_id);

-- ── Deep-dive research cache ──────────────────────────────────────────────────
create table if not exists profile_research (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  connection_id uuid references connections(id) on delete cascade not null,
  briefing jsonb,
  sources jsonb,
  fetched_at timestamptz default now(),
  unique (user_id, connection_id)
);

alter table profile_research enable row level security;
drop policy if exists "own research" on profile_research;
create policy "own research" on profile_research for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create index if not exists research_user_conn_idx on profile_research (user_id, connection_id);

-- ── Upload jobs (enrichment progress) ─────────────────────────────────────────
create table if not exists upload_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  total_connections int,
  enriched_count int default 0,
  status text default 'processing', -- processing / complete / failed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table upload_jobs enable row level security;
drop policy if exists "own jobs" on upload_jobs;
create policy "own jobs" on upload_jobs for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- ── User goals (persistent objectives across sessions) ─────────────────────────
create table if not exists user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  goal text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists user_goals_user_active on user_goals(user_id, active);
alter table user_goals enable row level security;
drop policy if exists "own goals" on user_goals;
create policy "own goals" on user_goals for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- ── Network actions (outreach tracking / promise loop) ─────────────────────────
create table if not exists network_actions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  connection_id uuid references connections(id) on delete cascade,
  linkedin_url text,
  action_type text not null default 'suggested',
  suggested_at timestamptz not null default now()
);

create index if not exists network_actions_user_time on network_actions(user_id, suggested_at desc);
alter table network_actions enable row level security;
drop policy if exists "own actions" on network_actions;
create policy "own actions" on network_actions for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- ── Extension auth tokens (long-lived bearer for the Chrome extension) ─────────
-- Read/written only via the service-role key. We store a sha256 hash, never the raw token.
create table if not exists extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists extension_tokens_user_idx on extension_tokens (user_id);
alter table extension_tokens enable row level security;  -- no client policy: service-role only

-- ── Raw LinkedIn observation events captured by the extension ──────────────────
create table if not exists linkedin_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,                 -- 'profile_view' (MVP); 'connection_seen' / 'message_seen' later
  linkedin_url text,                  -- normalized (linkedin.com/in/<slug>)
  payload jsonb,
  connection_id uuid references connections(id) on delete set null,
  freshened boolean not null default false,  -- true when it matched + refreshed a connection
  observed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists linkedin_events_user_time on linkedin_events (user_id, observed_at desc);
create index if not exists linkedin_events_user_fresh on linkedin_events (user_id, kind, freshened);
alter table linkedin_events enable row level security;
drop policy if exists "own events" on linkedin_events;
create policy "own events" on linkedin_events for all
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- When a connection was last refreshed by the extension (profile view),
-- and their current LinkedIn headline as last seen (top card — reliably correct).
alter table connections add column if not exists freshened_at timestamptz;
alter table connections add column if not exists current_headline text;
