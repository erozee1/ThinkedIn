# thinkedin

> **Talk to your network in one prompt.**

Import your LinkedIn connections and ask plain-English questions. thinkedin finds the right people, reasons over relationship signals, and gives you a personalized briefing before you ever send a message.

---

## Built for Pop the Bubble

This project was built during [**Pop the Bubble**](https://www.popthebubblehack.co.uk) — a 36-hour hackathon held in London, 5–7 June 2026. It's run by Hackhouse London and lambda.run, and it's genuinely selective: around a **12% acceptance rate** across 80 builders chosen from the applicant pool. The organising team described it as the most high-signal hackathon in London, and the prize reflects that — **£10,000 to the winner**, the largest first prize ever offered at a London hackathon.

The judging panel includes founders and CTOs from YC-backed companies, and the format is deliberately intense: three building tracks (Outbuild, Validate, and Effect), two milestone check-ins across the 36 hours, and a room full of people who are actually trying to win.

We built thinkedin under the **Outbuild** track — a superior version of what LinkedIn already offers, minus the noise.

---

## What it does

Your LinkedIn network is more valuable than it looks. Most people have hundreds of connections and no real way to query them. You either scroll endlessly or search by name — neither of which helps when you're trying to find a specific kind of person for a specific kind of thing.

thinkedin changes that. You upload two files LinkedIn lets you export — your `Connections.csv` and your `messages.csv` — and then you just ask:

- *"I want a tech internship now"*
- *"Find me 3 cracked cofounders my age"*
- *"Who do I actually know well at a big company?"*
- *"Who should I reconnect with?"*

The app reasons over your network — not just profile text, but relationship signals derived from your message history — and surfaces the right people with an explanation of why they fit and how warm the connection actually is.

---

## The features

### Natural language chat

Type what you're trying to do. The AI agent figures out what kind of person you're looking for, searches your network semantically, and returns real results with actual names, titles, companies, and an intro angle.

![Chat interface showing a user asking "find me 3 cracked cofounders my age" and receiving matched profile cards](./screenshots/chat.png)

### Relationship signals

Connections tell you who someone is. Messages tell you how well you know them. thinkedin derives a relationship strength for every connection — **close**, **active**, **warm**, or **dormant** — based on how recently and how often you've exchanged messages. Results are ranked and labelled accordingly, so a warm contact surfaces above a cold one.

![Profile cards with relationship strength pills and "last spoke X weeks ago" labels](./screenshots/relationship-cards.png)

### Warm path bridging

Sometimes you can't reach someone directly, but you know someone who knows them. The WarmPath panel maps the bridge — your connection at the same company, or a mutual coworker — so you can ask for an intro instead of cold messaging.

![Warm path panel showing a three-node graph: you → bridge contact → target](./screenshots/warm-path.png)

### Live deep dive

Click "Deep dive" on any profile and a research sub-agent goes out to the open web in real time. It reads their recent posts, finds news, checks their company, and streams back a briefing — what they're working on now, what's changed since you last spoke, and a specific intro angle tailored to your existing relationship. The result is cached and refreshable on demand.

![Deep dive panel streaming a live briefing with source links and a copy-ready intro draft](./screenshots/deep-dive.png)

### Chrome extension

The `thinked-in-extension` runs quietly alongside your normal LinkedIn browsing. Whenever you load a connection's profile, it captures the latest data and freshens your network — turning the one-time CSV import into a live, self-updating graph. It's read-only by design and never issues its own requests to LinkedIn.

### Privacy by default

Message history is opt-down, not opt-in. When you upload your messages file, you choose one of three modes:

| Mode | What gets stored | What it enables |
|------|-----------------|----------------|
| **Full** | Message content + subject lines, embedded for search | Topic queries ("who did I talk to about fundraising?") |
| **Relationship only** *(default)* | Who you spoke to, when, and how often — no content | Relationship strength and recency |
| **Skip messages** | Nothing | Profile-only queries |

You can change mode or wipe all message data at any time from the dashboard.

---

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Auth | Clerk |
| Database | Supabase Postgres + pgvector |
| Embeddings | OpenAI `text-embedding-3-small` |
| AI agent | Anthropic Claude (`claude-sonnet-4-6`) |
| LinkedIn enrichment | Apify |
| Styling | Tailwind CSS v4 + Framer Motion |
| Deploy | Vercel |
| Extension | WXT (Chrome MV3) |

The network query agent is tool-based — Claude picks from `search_by_meaning`, `query_by_filter`, `get_network_stats`, `keyword_search`, and (when permitted) `search_messages`, depending on what the question actually needs. It can call multiple tools before answering, and it reasons about what kind of person would fit before searching — not just matching keywords from the user's message.

---

## Project structure

```
Bubblehack/
├── thinked-in/              # Next.js web app
│   ├── app/                 # Pages (landing, dashboard, auth, proof)
│   ├── components/
│   │   ├── landing/         # Hero, animated chat demo, CTA bubble
│   │   └── dashboard/       # Chat interface, profile cards, warm path, deep dive
│   ├── lib/                 # Supabase, Anthropic, Apify, embeddings clients
│   ├── scripts/             # Offline enrichment + message ingest scripts
│   └── supabase/            # Schema SQL
└── thinked-in-extension/    # Chrome MV3 extension (WXT)
    └── entrypoints/         # Background worker, LinkedIn content script, popup
```

---

## Running it locally

**Web app**

```bash
cd thinked-in
npm install
# Add your keys to .env.local (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Chrome extension**

```bash
cd thinked-in-extension
npm install
npm run dev   # WXT launches Chrome with the extension loaded
```

**Required environment variables** (`.env.local` in `thinked-in/`):

```bash
# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Enrichment
APIFY_TOKEN=
APIFY_ACTIVITY_ACTOR=

# Web search (for deep dive)
SEARCH_API_KEY=
```

**Pre-enriching your connections** (recommended before demoing):

```bash
# Enrich profiles from a LinkedIn export
npx tsx scripts/enrich.ts connections.csv <your-supabase-user-id>

# Ingest message history (choose: full / metadata)
npx tsx scripts/ingest-messages.ts messages.csv <your-supabase-user-id> full
```

This runs enrichment offline so the demo never depends on live scraping during judging.

---

## How the agent works

The chat agent is not a simple semantic search. It reasons before it searches.

When you ask *"who could buy the bricks I'm selling?"*, the agent doesn't embed that sentence and hope for the best. It first works out who would buy bricks — construction firms, property developers, builders' merchants — and then searches for those people. The query it passes to the vector search is its own description of the ideal candidate, not your words.

It can call multiple tools in sequence, over-fetch with a wider net, and then judge which results actually fit before writing its answer. For counts and summaries it queries the whole network rather than a top-N slice. For topic questions (in full message mode) it does a semantic search over your conversation history and joins results back to the matching connection.

The relationship layer runs entirely independently of profile enrichment — so relationship queries ("who should I reconnect with?") still work even for connections whose Apify scrape is still pending.

---

*Built in 36 hours at Pop the Bubble, London — June 2026.*
