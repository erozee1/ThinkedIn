// Shared page backdrop: a clean Frutiger-Aero cool-blue sky with a subtle glossy
// top sheen and soft white clouds drifting slowly. Identical across landing /
// sign-in / sign-up so transitions stay seamless.
export default function BackgroundFX({ light = false }: { light?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora" />
      {light && <div className="absolute inset-0 bg-white/50" />}

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
