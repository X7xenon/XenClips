import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/publish-store";

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  if (platform === "youtube") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(255,0,0,0.1)] border border-[rgba(255,0,0,0.2)]",
          className,
        )}
      >
        <div className="w-2 h-2 rounded-full bg-[#FF0000] shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
        <span className="text-[10px] font-display uppercase tracking-wider font-bold text-[#FF0000]">
          YouTube Shorts
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-[rgba(131,58,180,0.1)] via-[rgba(253,29,29,0.1)] to-[rgba(252,176,69,0.1)] border border-[rgba(253,29,29,0.2)]",
        className,
      )}
    >
      <div className="w-2 h-2 rounded-full bg-gradient-to-tr from-[#833ab4] via-[#fd1d1d] to-[#fcb045] shadow-[0_0_8px_rgba(253,29,29,0.6)]" />
      <span className="text-[10px] font-display uppercase tracking-wider font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
        Instagram Reels
      </span>
    </div>
  );
}
