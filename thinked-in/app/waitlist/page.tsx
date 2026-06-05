import { Waitlist } from "@clerk/nextjs";

export default function WaitlistPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black py-24">
      <Waitlist />
    </div>
  );
}
