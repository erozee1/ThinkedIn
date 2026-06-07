-- Vector-search RPCs. Run AFTER schema.sql. Re-run this whole file to update.
-- Scoped explicitly by p_user_ids (the Clerk-verified user ids passed from the API).
-- p_user_ids contains [userId] for solo users and all org member ids for org members.

create or replace function match_connections(
  p_user_ids text[],
  query_embedding vector(1536),
  match_count int default 20,
  filter_country text default null,
  filter_company text default null,
  filter_seniority text default null,
  filter_industry text default null,
  filter_relationship text default null,
  filter_min_messages int default null
)
returns table (
  id uuid,
  user_id text,
  first_name text,
  last_name text,
  "position" text,
  company text,
  location text,
  country text,
  seniority text,
  industry text,
  summary text,
  linkedin_url text,
  relationship_strength text,
  last_contacted timestamptz,
  message_count int,
  distance float
)
language sql
stable
as $$
  select c.id, c.user_id, c.first_name, c.last_name, c.position, c.company,
         c.location, c.country, c.seniority, c.industry, c.summary,
         c.linkedin_url, c.relationship_strength, c.last_contacted,
         c.message_count,
         (c.embedding <=> query_embedding) as distance
  from connections c
  where c.user_id = any(p_user_ids)
    and c.enrichment_status = 'enriched'
    and c.embedding is not null
    and (filter_country is null or c.country_norm = lower(filter_country))
    and (filter_company is null or c.company_norm ilike '%' || lower(filter_company) || '%')
    and (filter_seniority is null or c.seniority = filter_seniority)
    and (filter_industry is null or c.industry ilike '%' || filter_industry || '%')
    and (filter_relationship is null or c.relationship_strength = filter_relationship)
    and (filter_min_messages is null or c.message_count >= filter_min_messages)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function match_messages(
  p_user_id text,
  query_embedding vector(1536),
  match_count int default 20
)
returns table (
  subject text,
  content text,
  direction text,
  sent_at timestamptz,
  partner_name text,
  connection_id uuid,
  first_name text,
  last_name text,
  company text,
  linkedin_url text,
  distance float
)
language sql
stable
as $$
  select m.subject, m.content, m.direction, m.sent_at, m.partner_name,
         m.connection_id, c.first_name, c.last_name, c.company, c.linkedin_url,
         (m.embedding <=> query_embedding) as distance
  from messages m
  left join connections c on c.id = m.connection_id
  where m.user_id = p_user_id
    and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
