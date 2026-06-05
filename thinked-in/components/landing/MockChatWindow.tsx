import { Sparkles } from "lucide-react";
import ChatDemo from "./ChatDemo";

// The demo conversation sitting inside a glassy chat window, tilted in 3D
// (Frutiger-Aero glossy product mockup). Flat on mobile, angled on md+.
export default function MockChatWindow() {
  return (
    <div className="mx-auto w-full max-w-lg [perspective:1600px]">
      <div className="transition-transform duration-500 ease-out md:[transform:rotateX(13deg)_rotateY(-13deg)_rotateZ(1.5deg)]">
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/65 shadow-[0_40px_90px_-25px_rgba(12,74,140,0.55)] backdrop-blur-xl">
          {/* Title bar */}
          <div className="flex items-center gap-3 border-b border-black/5 bg-white/85 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-blue">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold leading-tight text-foreground">
                Your network
              </p>
              <p className="flex items-center gap-1 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                312 connections · online
              </p>
            </div>
            <div className="ml-auto flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
            </div>
          </div>

          {/* Conversation */}
          <div className="px-2 py-6">
            <ChatDemo />
          </div>
        </div>
      </div>
    </div>
  );
}
