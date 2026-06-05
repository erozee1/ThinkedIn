// Shared page backdrop: static aurora base + slow-moving color blobs (animated
// gradient energy) + a faint floating "network" of nodes/lines + blurred profile
// bubbles in the periphery. Reused across landing / sign-in / sign-up so the
// background is identical and transitions stay seamless.
export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Static base gradient (identical across pages) */}
      <div className="aurora" />

      {/* Slow-moving color blobs */}
      <div
        className="fx-blob -left-24 top-[-10%] h-80 w-80"
        style={{ background: "#378fe9", animation: "fx-float-1 22s ease-in-out infinite" }}
      />
      <div
        className="fx-blob right-[-8%] top-[8%] h-72 w-72"
        style={{ background: "#70b5f9", animation: "fx-float-2 27s ease-in-out infinite" }}
      />
      <div
        className="fx-blob bottom-[-12%] left-[35%] h-96 w-96"
        style={{ background: "#0a66c2", opacity: 0.35, animation: "fx-float-3 31s ease-in-out infinite" }}
      />

      {/* Faint network — connecting lines + nodes, drifting in the periphery */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <g
          className="fx-node-group"
          style={{ animation: "fx-node-float 18s ease-in-out infinite" }}
          stroke="#0a66c2"
          strokeWidth="1.2"
          opacity="0.16"
        >
          <line x1="70" y1="120" x2="240" y2="60" />
          <line x1="240" y1="60" x2="180" y2="260" />
          <line x1="70" y1="120" x2="180" y2="260" />
          <line x1="820" y1="90" x2="930" y2="240" />
          <line x1="820" y1="90" x2="700" y2="180" />
          <line x1="120" y1="820" x2="280" y2="900" />
          <line x1="900" y1="780" x2="780" y2="900" />
          <line x1="900" y1="780" x2="950" y2="620" />
          {[
            [70, 120], [240, 60], [180, 260], [820, 90], [930, 240],
            [700, 180], [120, 820], [280, 900], [900, 780], [780, 900], [950, 620],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 6 : 4} fill="#0a66c2" stroke="none" />
          ))}
        </g>
      </svg>

      {/* Blurred "profile bubble" hints floating at the edges */}
      <div
        className="fx-blob left-[6%] top-[28%] h-16 w-16 ring-2 ring-white/30"
        style={{ background: "#378fe9", opacity: 0.28, filter: "blur(8px)", animation: "fx-float-2 24s ease-in-out infinite" }}
      />
      <div
        className="fx-blob right-[10%] bottom-[22%] h-20 w-20 ring-2 ring-white/30"
        style={{ background: "#0a66c2", opacity: 0.22, filter: "blur(10px)", animation: "fx-float-1 29s ease-in-out infinite" }}
      />
    </div>
  );
}
