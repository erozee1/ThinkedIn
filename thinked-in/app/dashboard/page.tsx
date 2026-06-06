import DashboardApp from "@/components/dashboard/DashboardApp";

// Route is protected by Clerk's proxy.ts (only /sign-in and /sign-up are public).
export default function DashboardPage() {
  return <DashboardApp />;
}
