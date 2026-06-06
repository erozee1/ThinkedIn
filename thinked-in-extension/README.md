# thinked-in-extension

Chrome (MV3) extension that **passively observes** the LinkedIn actions a user
takes in their own browser and sends them to their thinkedin account — turning
the static CSV import into a live, behaviorally-weighted network graph.

**Design rule: read-only.** It only reads pages the user organically loads. It
never issues its own requests to LinkedIn, never prefetches, never automates
actions. (See the repo discussion for why this keeps account-standing risk ~nil.)

Talks to the `thinked-in` app over one HTTP contract: `POST /api/events`.
The event schema is the shared source of truth between this extension (producer)
and that endpoint (consumer).

Status: **planning / pre-MVP.**
