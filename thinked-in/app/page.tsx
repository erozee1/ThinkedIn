import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { GlassLinkButton } from "@/components/GlassButton";
import ChatDemo from "@/components/landing/ChatDemo";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden">
      {/* Animated dynamic-hue backdrop */}
      <div className="aurora" aria-hidden />

      {/* Background: looping fake conversation, slightly blurred + dimmed */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div className="w-full scale-105 opacity-70 blur-[3px]">
          <ChatDemo />
        </div>
      </div>

      {/* Brand — top */}
      <header className="relative z-10 flex items-center justify-center px-6 py-7">
        {/* TODO: replace wordmark with the real PNG logo when provided. */}
        <span className="text-xl font-semibold tracking-tight text-gradient">
          thinkedin
        </span>
      </header>

      {/* Foreground: tagline + glassy CTA sitting on top of the chat */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground drop-shadow-[0_2px_24px_rgba(4,7,15,0.8)] sm:text-6xl">
          Talk to your network
          <br />
          <span className="text-gradient">in one prompt</span>
        </h1>
        <p className="max-w-md text-balance text-base text-muted drop-shadow-[0_2px_16px_rgba(4,7,15,0.9)] sm:text-lg">
          Import your LinkedIn connections and just ask. thinkedin finds the
          right people for whatever you need.
        </p>
        <GlassLinkButton href="/sign-in">
          Get started
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </GlassLinkButton>
      </div>
    </main>
  );
}
