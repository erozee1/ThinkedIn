import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import GetStartedBubble from "@/components/landing/GetStartedBubble";
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

        <GetStartedBubble />

        <div className="mt-12 w-full">
          <ChatDemo />
        </div>
      </div>
    </main>
  );
}
