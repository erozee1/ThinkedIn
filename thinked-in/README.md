# thinkedin

**Talk to your network in one prompt.** Import your LinkedIn connections and chat
with them — ask in plain English and thinkedin surfaces the right people.

## Status

The **frontend** is built and runs against **stubbed `/api` routes** that return
realistic mock data. The real backend (Supabase + pgvector, Apify enrichment,
OpenAI embeddings, live Claude) drops in behind those same endpoints later without
changing components.

### What's here
- **Landing** (`app/page.tsx`) — looping animated chat demo behind a glassy CTA.
- **Onboarding** (`components/dashboard/OnboardingFlow.tsx`) — import prompt →
  consent → animated Apify-style enrichment → "Let's chat".
- **Chat** (`components/dashboard/ChatApp.tsx`) — Claude-style sidebar + streaming
  chat that renders matched LinkedIn profile cards inline.
- **Stub API** (`app/api/{upload,enrich,chat}`) — Clerk-guarded handlers returning
  mock data; `/api/chat` streams NDJSON.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with the required keys (see below).
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create a `.env.local` (gitignored). **Clerk keys are required to run the app**:

```bash
# Clerk auth — REQUIRED. Get from the Clerk dashboard or a teammate.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
# Use our themed in-app sign-in/up pages instead of Clerk's hosted portal.
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Gemini — used by /api/chat for chat replies.
GEMINI_API_KEY=

# Future backend (not used yet — frontend uses stub /api routes):
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# APIFY_TOKEN=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Clerk (auth) ·
framer-motion · lucide-react.

## Demo flow

Land on `/` → **Get started** → sign in (Clerk) → onboarding import prompt → drop a
LinkedIn `Connections.csv` → consent → enrichment animation → **Let's chat** → ask
*"Find me someone who owns a software company in England."* Returning users skip
straight to chat; **Re-import** in the sidebar replays onboarding.

<!-- Rebuild trigger -->
