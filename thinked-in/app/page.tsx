import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BackgroundFX from "@/components/BackgroundFX";
import SiteMast from "@/components/SiteMast";
import LandingHero from "@/components/landing/LandingHero";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      {/* Shared backdrop — covers the full page (incl. behind the translucent mast) */}
      <BackgroundFX variant="landing" />

      {/* Sticky mast (outside the clipped/animated content so sticky works) */}
      <SiteMast />

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <LandingHero />
      </main>
    </div>
  );
}
