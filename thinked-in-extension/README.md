# thinked-in-extension

Chrome (MV3) extension that **passively observes** the LinkedIn profiles you view
and freshens your thinkedin network — turning the static CSV import into a live,
self-healing graph.

**Design rule: read-only.** It only reads pages you organically load. It never
issues its own requests to LinkedIn, never prefetches, never automates actions.

It talks to the `thinked-in` Next/Vercel app over one HTTP contract:
`POST /api/events` (+ `GET` for counts). The shared event shape lives in
`shared/events.ts`.

## Layout
```
shared/events.ts          contract shared with the backend
lib/                      config, storage, api client, message types
entrypoints/
  background.ts           token + event batching + POST + icon state
  linkedin.content.ts     /in/* read-only profile grab
  connect.content.ts      catches the token from the connect page
  popup/                  the popup UI (login / reading / paused / settings)
public/icon-base.png      toolbar icon (composited with status glyph at runtime)
```

## Run it (MVP)
1. `npm install`
2. Point it at your backend: edit `DEFAULT_BASE_URL` in `lib/config.ts`
   (default `http://localhost:3000`; use your Vercel URL for prod — and make sure
   `host_permissions` in `wxt.config.ts` covers it).
3. Run the `thinked-in` app so the backend is reachable, and apply
   `thinked-in/supabase/schema.sql`'s extension tables.
4. `npm run dev` — WXT launches Chrome with the extension loaded
   (or `npm run build` and load `.output/chrome-mv3` unpacked).
5. Click the toolbar icon → **Connect** → sign in → token is stored.
6. Browse a LinkedIn profile that's one of your connections → the popup's
   "freshened today" ticks up; the icon shows the green status glyph.

Toggle capture channels via the settings cog; turning all off greys the icon
(paused). Log out with the red icon top-right.

Status: **MVP — profile capture wired. Connections + messages channels are stubbed.**
