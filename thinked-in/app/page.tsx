import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BackgroundFX from "@/components/BackgroundFX";
import LandingHero from "@/components/landing/LandingHero";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/* Shared backdrop — identical to /sign-in for a seamless transition */}
      <BackgroundFX />
      <LandingHero />
    </main>
  );
}
