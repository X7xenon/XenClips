import { useState, useEffect } from "react";
import { Sparkles, Copy, Check, RefreshCcw, Type } from "lucide-react";
import type { PlatformMetadata } from "@/lib/metadata-generator";
import type { Platform } from "@/lib/publish-store";

interface MetadataPanelProps {
  platform: Platform;
  metadata: PlatformMetadata | null;
  isGenerating: boolean;
  onRegenerate: (platform: Platform) => void;
  onChange: (platform: Platform, updated: PlatformMetadata) => void;
}

export function MetadataPanel({
  platform,
  metadata,
  isGenerating,
  onRegenerate,
  onChange,
}: MetadataPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!metadata) return;
    const text = `${metadata.title}\n\n${metadata.caption}\n\n${metadata.hashtags.map((h) => `#${h}`).join(" ")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const limits = {
    youtube: { title: 100, caption: 5000 },
    instagram: { title: 0, caption: 2200 }, // IG uses caption mostly
  };

  const currentLimits = limits[platform];

  if (!metadata && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 border border-white/10 rounded-xl">
        <Sparkles className="w-8 h-8 text-gray-500 mb-3" />
        <p className="text-gray-400 text-sm">Select a clip to generate AI metadata</p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/5 border border-[#00F0FF]/20 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#00F0FF]/10 to-[#8A2BE2]/10 animate-pulse" />
        <div className="premium-spinner w-8 h-8 mb-4 relative z-10" />
        <p className="text-[#00F0FF] font-display uppercase tracking-widest font-bold text-xs relative z-10">
          Synthesizing Viral Metadata...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="label-section !mb-0">
          {platform === "youtube" ? "YouTube Shorts" : "Instagram Reels"} Metadata
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onRegenerate(platform)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors border border-white/10"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Regenerate
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(0,240,255,0.1)] hover:bg-[rgba(0,240,255,0.2)] text-xs font-bold text-[#00F0FF] transition-colors border border-[rgba(0,240,255,0.2)]"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      {platform === "youtube" && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
              <Type className="w-3 h-3" /> Title
            </span>
            <span
              className={`text-[10px] font-mono ${metadata!.title.length > currentLimits.title ? "text-[#FF2A5F]" : "text-gray-500"}`}
            >
              {metadata!.title.length} / {currentLimits.title}
            </span>
          </div>
          <input
            type="text"
            value={metadata!.title}
            onChange={(e) => onChange(platform, { ...metadata!, title: e.target.value })}
            className={`w-full bg-[rgba(10,10,15,0.5)] border ${metadata!.title.length > currentLimits.title ? "border-[#FF2A5F]" : "border-white/10"} rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#00F0FF]`}
            placeholder="Catchy title..."
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-400">Caption / Description</span>
          <span
            className={`text-[10px] font-mono ${metadata!.caption.length > currentLimits.caption ? "text-[#FF2A5F]" : "text-gray-500"}`}
          >
            {metadata!.caption.length} / {currentLimits.caption}
          </span>
        </div>
        <textarea
          value={metadata!.caption}
          onChange={(e) => onChange(platform, { ...metadata!, caption: e.target.value })}
          className={`w-full bg-[rgba(10,10,15,0.5)] border ${metadata!.caption.length > currentLimits.caption ? "border-[#FF2A5F]" : "border-white/10"} rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-[#00F0FF] min-h-[120px] resize-y`}
          placeholder="Write an engaging caption..."
        />
      </div>

      <div>
        <span className="text-xs font-medium text-gray-400 mb-2 block">Hashtags</span>
        <div className="flex flex-wrap gap-2">
          {metadata!.hashtags.map((tag, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300"
            >
              <span className="text-gray-500">#</span>
              <input
                type="text"
                value={tag}
                onChange={(e) => {
                  const newTags = [...metadata!.hashtags];
                  newTags[i] = e.target.value.replace(/#/g, "");
                  onChange(platform, { ...metadata!, hashtags: newTags });
                }}
                className="bg-transparent border-none p-0 w-[80px] focus:outline-none focus:ring-0 text-white"
              />
              <button
                onClick={() => {
                  const newTags = metadata!.hashtags.filter((_, idx) => idx !== i);
                  onChange(platform, { ...metadata!, hashtags: newTags });
                }}
                className="text-gray-500 hover:text-[#FF2A5F] ml-1"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange(platform, { ...metadata!, hashtags: [...metadata!.hashtags, ""] })
            }
            className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-md text-xs text-gray-400 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
