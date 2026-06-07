// Shared page backdrop. The landing page uses autonomous floating blobs;
// auth/dashboard keep the calmer static aurora variant.
export default function BackgroundFX({
  light = false,
  variant = "default",
}: {
  light?: boolean;
  variant?: "default" | "landing";
}) {
  const isLanding = variant === "landing";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora" />

      {isLanding ? (
        <>
          {/* Static gradient layer over the aurora */}
          <div className="absolute inset-0 bg-[radial-gradient(42%_32%_at_74%_5%,rgba(255,255,255,0.58),transparent_60%),linear-gradient(180deg,#74b7ee_0%,#7bbdf0_28%,#8dc5f3_58%,#add9f7_100%)]" />
          {/* Autonomous floating blobs */}
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
        </>
      ) : null}

      {light ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#d8edf8_0%,#e4f3fb_30%,#eef8fd_65%,#f6fbfe_100%)]" />
      ) : null}

      {/* Slow-drifting clouds */}
      <div className="cloud left-[6%] top-[10%] h-40 w-72" style={{ animation: "cloud-a 60s ease-in-out infinite alternate" }} />
      <div className="cloud right-[12%] top-[5%] h-32 w-80" style={{ animation: "cloud-b 74s ease-in-out infinite alternate" }} />
      <div className="cloud left-[40%] top-[24%] h-36 w-64" style={{ animation: "cloud-c 66s ease-in-out infinite alternate" }} />
      <div className="cloud right-[28%] top-[42%] h-28 w-64" style={{ animation: "cloud-a 84s ease-in-out infinite alternate" }} />

      {/* Glossy top sheen */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
    </div>
  );
}
