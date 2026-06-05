// Shared page backdrop: a clean Frutiger-Aero cool-blue sky with a subtle glossy
// top sheen. Identical across landing / sign-in / sign-up so transitions stay
// seamless.
export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora" />
      {/* Glossy top sheen */}
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent" />
    </div>
  );
}
