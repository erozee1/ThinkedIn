import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { GlassLinkButton } from "@/components/GlassButton";
import ChatDemo from "@/components/landing/ChatDemo";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* Dimmed dynamic-hue backdrop */}
      <div className="aurora" aria-hidden />

      {/* Brand — top */}
      <header className="relative z-10 flex items-center justify-center px-6 py-7">
        {/* TODO: replace wordmark with the real PNG logo when provided. */}
        <span className="text-xl font-semibold tracking-tight text-gradient">
          thinkedin
        </span>
      </header>

      {/* Headline above, then CTA, then the live (unblurred) chat showcase */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-16 pt-4 text-center">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          Talk to your network
          <br />
          <span className="text-foreground/55">in one prompt</span>
        </h1>

        <GlassLinkButton href="/sign-in" className="mt-8">
          Get started
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </GlassLinkButton>

        <div className="mt-14 w-full">
          <ChatDemo />
        </div>
      </div>
    </main>
  );
}
