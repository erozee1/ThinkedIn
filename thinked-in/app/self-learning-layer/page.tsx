import type { Metadata } from "next";
import SiteMast from "@/components/SiteMast";

export const metadata: Metadata = {
  title: "The Self-Learning Layer · thinked-in",
  description:
    "How thinked-in remembers across conversations — a memory layer, powered by Mubit, that turns past intent into future serendipity.",
};

const steps = [
  {
    id: "01",
    badge: "Remember",
    title: "It remembers what matters to you",
    body:
      "The moment you tell the assistant a goal — “I'm raising a pre-seed round,” “I want to break into climate tech” — it quietly commits that intent to long-term memory. Not a transcript dump: the things that actually shape who you should be talking to.",
    aside: "When you set a goal, we save it.",
  },
  {
    id: "02",
    badge: "Recall",
    title: "It brings the right memory back at the right moment",
    body:
      "Weeks later, when you ask something new, the layer surfaces the past intent that quietly connects to it — before you've remembered it yourself. A goal you set in March collides with a question you ask in June, and suddenly the assistant points you somewhere you'd have missed.",
    aside: "Old intent meets your new question.",
  },
  {
    id: "03",
    badge: "Follow through",
    title: "It closes the loop on its own suggestions",
    body:
      "Every introduction it recommends is remembered. So next session it can do the thing a great chief-of-staff does — follow up. “Last week I suggested you reach out to Priya. Did that go anywhere?” The assistant holds the thread so you don't have to.",
    aside: "It remembers who it suggested — and checks back.",
  },
];

export default function SelfLearningLayerPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteMast />

      <div className="mx-auto max-w-2xl px-8 pb-28 pt-12">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            How it works · Memory
          </p>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            The <span className="text-gradient">Self-Learning Layer</span>
          </h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-zinc-500">
            Most AI assistants have amnesia — every conversation starts from
            zero. thinked-in doesn&apos;t. A memory layer sits underneath every
            chat, so your assistant gets to know you over time.
          </p>
        </div>

        {/* The shift — before / after */}
        <div className="mb-20 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Every other assistant
            </p>
            <p className="text-sm leading-relaxed text-zinc-500">
              Forgets you the moment you close the tab. You re-explain who you
              are, what you&apos;re working on, and who you&apos;ve already
              spoken to — every single time.
            </p>
          </div>
          <div className="glass-strong rounded-2xl p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#0a66c2]">
              thinked-in
            </p>
            <p className="text-sm leading-relaxed text-zinc-700">
              Remembers your goals, recalls them when they matter, and follows
              up on its own suggestions. The conversation picks up where your
              life left off.
            </p>
          </div>
        </div>

        {/* The loop — numbered timeline */}
        <div className="relative">
          <div className="absolute left-7 top-2 h-[calc(100%-1rem)] w-0.5 bg-zinc-200" />

          {steps.map((step) => (
            <div key={step.id} className="relative mb-12 flex items-start gap-5">
              <div className="flex w-14 shrink-0 justify-center">
                <div className="bg-gradient-blue relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(10,102,194,0.65)] ring-4 ring-white">
                  {step.id}
                </div>
              </div>
              <div className="flex-1 pt-1">
                <span className="mb-2 inline-block rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {step.badge}
                </span>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {step.body}
                </p>
                <p className="mt-3 border-l-2 border-blue-300 pl-3 text-sm font-medium italic text-zinc-700">
                  {step.aside}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Temporal serendipity — the big idea */}
        <div className="mb-16 rounded-2xl bg-zinc-900 px-7 py-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            The big idea · Temporal serendipity
          </p>
          <p className="text-lg font-medium leading-relaxed text-white">
            Your most valuable connections aren&apos;t the ones you&apos;re
            thinking about today. They&apos;re the intent you archived months
            ago, resurfacing exactly when it becomes useful.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            The self-learning layer is what lets a goal from the past collide
            with a question in the present — turning a forgetful chatbot into an
            assistant that actually compounds in value the more you use it.
          </p>
        </div>

        {/* How we built it — light technical, judge-friendly */}
        <div className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Under the hood
          </p>
          <p className="text-sm leading-relaxed text-zinc-600">
            We didn&apos;t want to reinvent memory, so we built the layer on{" "}
            <span className="font-semibold text-zinc-900">Mubit</span> — a
            dedicated agent-memory engine. Three lightweight hooks sit inside our
            assistant: one to <span className="font-medium text-zinc-900">remember</span>{" "}
            a goal, one to <span className="font-medium text-zinc-900">recall</span>{" "}
            relevant memories the instant you start a new message, and one to{" "}
            <span className="font-medium text-zinc-900">record</span> who was
            suggested so the loop can close. It runs alongside every chat without
            slowing it down, and degrades gracefully — if memory is ever
            unavailable, the assistant simply carries on.
          </p>
        </div>

        {/* Powered by Mubit */}
        <div className="flex flex-col items-center gap-3 border-t border-zinc-100 pt-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Powered by
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm font-semibold text-zinc-700">
            <span className="bg-gradient-blue h-2 w-2 rounded-full" />
            Mubit · Agent Memory
          </span>
          <p className="mt-1 max-w-sm text-sm text-zinc-400">
            The memory engine behind thinked-in&apos;s self-learning layer.
          </p>
        </div>
      </div>
    </div>
  );
}
