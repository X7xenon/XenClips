import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Maximize2,
  Loader2,
  Save,
  Download,
  AlertTriangle,
  Info,
  Edit2,
  X,
} from "lucide-react";
import { LayoutPicker } from "@/components/layout-picker";
import { api, getApiBase, getCurrentJob, type Clip, type LayoutTemplate } from "@/lib/api";

export const Route = createFileRoute("/clips/$clipId")({
  component: ClipEditor,
});

type Platform = "reels" | "shorts" | "tiktok";

const EMOJI_CHOICES = ["🔥", "😮", "💡", "❤️", "😂", "🤯", "✨", "👀", "🎯", "🚀"];

const TEMPLATE_LABELS: Record<string, string> = {
  alex_hormozi: "Alex Hormozi",
  mrbeast: "MrBeast",
  iman_gadzhi: "Iman Gadzhi",
  ali_abdaal: "Ali Abdaal",
  podcast: "Podcast",
  gaming: "Gaming",
  motivational: "Motivational",
  minimal_clean: "Minimal Clean",
  tiktok_viral: "TikTok Viral",
  premium_cinematic: "Premium Cinematic",
  cyberpunk: "Cyberpunk",
  hacker: "Hacker Terminal",
  dreamy: "Dreamy Cloud",
  news_flash: "News Flash",
  y2k_bubbly: "Y2K Bubbly",
  comic_book: "Comic Book",
  typewriter: "Typewriter",
  liquid_glass: "Liquid Glass",
  blueprint: "Blueprint",
  street_graffiti: "Street Graffiti",
  luxury_marble: "Luxury Marble",
  comic_manga: "Comic Manga",
  holographic: "Holographic",
  old_newspaper: "Old Newspaper",
  blueprint_hud: "Blueprint HUD",
};

const PLATFORM_ICONS: Record<Platform, string> = {
  reels: "📸",
  shorts: "▶️",
  tiktok: "🎵",
};

const SAFE_ZONES: Record<Platform, { top: number; bottom: number; right: number; left: number }> = {
  reels: { top: 8, bottom: 22, right: 16, left: 4 },
  shorts: { top: 8, bottom: 18, right: 14, left: 4 },
  tiktok: { top: 6, bottom: 24, right: 18, left: 4 },
};

function resolveVideoUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase().replace(/\/$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

/* ══ Clip Editor ════════════════════════════════════════════════ */
function ClipEditor() {
  const { clipId } = Route.useParams();

  const [clip, setClip] = useState<Clip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutTemplate>("full_vertical");
  const [hookText, setHookText] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [platform, setPlatform] = useState<Platform>("reels");
  const [fontSize, setFontSize] = useState(90);
  const [captionPos, setCaptionPos] = useState<"bottom" | "center" | "top">("bottom");
  const [maxWords, setMaxWords] = useState(2);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reLayouting, setReLayouting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const [captions, setCaptions] = useState<Array<{ text: string; start: number; end: number }>>([]);
  const [isEditingCaptions, setIsEditingCaptions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [savingCaptions, setSavingCaptions] = useState(false);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);

  useBlocker({
    shouldBlockFn: () => {
      if (!reLayouting) return false;
      return !window.confirm("Layout re-render is in progress. Leave anyway?");
    },
    enableBeforeUnload: () => reLayouting,
  });

  useEffect(() => {
    const jobId = getCurrentJob();
    if (!jobId) {
      setError("No active job. Open a job from the Clips tab.");
      return;
    }
    let cancelled = false;

    api
      .clips(jobId)
      .then((clips) => {
        if (cancelled) return;
        const c = clips.find((x) => x.clip_id === clipId);
        if (!c) {
          setError("Clip not found in current job.");
          return;
        }
        setClip(c);
        setLayout(c.layout || "full_vertical");
        setHookText(c.hook_text || "");
        setEmoji(c.emoji || "🔥");
        setFontSize(c.font_size || 90);
        setCaptionPos(c.position || "bottom");
        setMaxWords(c.max_words || 2);
      })
      .catch((e) => setError((e as Error).message));

    api
      .getCaptions(clipId)
      .then((words) => {
        if (!cancelled) setCaptions(words);
      })
      .catch((e) => {
        if (!cancelled) setCaptionsError((e as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [clipId]);

  const changeLayout = async (next: LayoutTemplate) => {
    if (!clip || next === layout) return;
    const prev = layout;
    setLayout(next);
    setReLayouting(true);
    try {
      const updated = await api.updateClip(clip.clip_id, { layout: next });
      setClip(updated);
    } catch (e) {
      setError((e as Error).message);
      setLayout(prev);
    } finally {
      setReLayouting(false);
    }
  };

  const saveMetadata = async () => {
    if (!clip) return;
    setSaving(true);
    try {
      const updated = await api.updateClip(clip.clip_id, {
        hook_text: hookText,
        emoji,
        font_size: fontSize,
        position: captionPos,
        max_words: maxWords,
      });
      setClip(updated);
      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reExport = async () => {
    if (!clip) return;
    setExporting(true);
    try {
      if (dirty) {
        await api.updateClip(clip.clip_id, {
          hook_text: hookText,
          emoji,
          font_size: fontSize,
          position: captionPos,
          max_words: maxWords,
        });
        setDirty(false);
      }
      const res = await api.exportClip(clip.clip_id);
      if (res.video_path) setClip({ ...clip, video_path: res.video_path });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const saveCaptions = async () => {
    if (!clip) return;
    setSavingCaptions(true);
    setCaptionsError(null);
    try {
      await api.updateCaptions(clip.clip_id, captions);
      setIsEditingCaptions(false);
      setSavedAt(Date.now());
    } catch (e) {
      setCaptionsError((e as Error).message);
    } finally {
      setSavingCaptions(false);
    }
  };

  const handleWordChange = (idx: number, text: string) => {
    const next = [...captions];
    next[idx] = { ...next[idx], text };
    setCaptions(next);
    setDirty(true);
  };

  if (error && !clip) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <BackLink />
        <div className="mt-8 p-6 rounded-2xl bg-[rgba(255,42,95,0.1)] border border-[rgba(255,42,95,0.4)] flex gap-4 items-start shadow-[0_10px_30px_rgba(255,42,95,0.15)]">
          <div className="w-10 h-10 rounded-full bg-[rgba(255,42,95,0.2)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#FF2A5F]" />
          </div>
          <div>
            <h4 className="text-[#FF2A5F] font-bold text-lg mb-1">Editor Failed to Load</h4>
            <p className="text-sm text-[rgba(255,255,255,0.7)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <BackLink />
        <div className="mt-20 flex flex-col items-center justify-center gap-4">
          <div className="premium-spinner w-8 h-8 border-4" />
          <span className="text-sm text-gray-400 font-display uppercase tracking-widest font-semibold">
            Preparing Studio...
          </span>
        </div>
      </div>
    );
  }

  const videoUrl = resolveVideoUrl(clip.video_path);
  const templateLabel = TEMPLATE_LABELS[clip.template ?? ""] ?? clip.template ?? "—";
  const posLabel = (clip.position ?? "bottom").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <BackLink />
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs text-gray-400 font-medium">
              Saved {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={saveMetadata}
            disabled={saving || !dirty}
            className={`btn-outline !py-2 !px-4 ${dirty ? "border-[#00F0FF] text-[#00F0FF]" : ""}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={reExport}
            disabled={exporting || reLayouting}
            className="btn-primary !py-2 !px-5"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Render Video
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* ════ Left column — Video Preview ════ */}
        <div className="flex flex-col gap-6">
          <div className="relative glass-panel overflow-hidden p-1">
            <div
              className="relative rounded-[11px] overflow-hidden bg-black"
              style={{ aspectRatio: "9/16" }}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="premium-spinner w-8 h-8" />
                </div>
              )}

              {/* Safe zone overlay */}
              {showSafeZone && <SafeZoneOverlay platform={platform} />}

              {/* Hook text preview */}
              <div className="pointer-events-none absolute inset-x-4 top-[15%] flex justify-center">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 text-white font-bold text-sm shadow-lg text-center leading-tight">
                  <span className="mr-2 text-lg align-middle">{emoji}</span>
                  {hookText}
                </div>
              </div>

              {/* Re-layout spinner */}
              {reLayouting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm z-20">
                  <div className="premium-spinner w-10 h-10 border-4" />
                  <div className="text-center">
                    <div className="text-white font-bold font-display tracking-wide mb-1">
                      Applying Layout
                    </div>
                    <div className="text-gray-400 text-xs">AI cropping in progress...</div>
                  </div>
                </div>
              )}

              {/* Real-time Caption Preview */}
              {showPreview && !showThumbnail && (
                <CaptionPreview
                  captions={captions}
                  currentTime={currentTime}
                  maxWords={maxWords}
                  fontSize={fontSize}
                  position={captionPos}
                  template={clip.template || "alex_hormozi"}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 justify-between glass-panel p-3">
            <button
              onClick={() => videoRef.current?.requestFullscreen?.()}
              disabled={!videoUrl}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest font-display">
                Fullscreen
              </span>
            </button>
            <div className="text-xs text-[#00F0FF] bg-[rgba(0,240,255,0.1)] px-3 py-1 rounded-full border border-[rgba(0,240,255,0.2)] font-medium">
              {templateLabel} · {posLabel}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="label-section">PLATFORM PREVIEW</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPreview}
                    onChange={(e) => setShowPreview(e.target.checked)}
                    style={{ accentColor: "var(--primary)", width: 12, height: 12 }}
                  />
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    Real-time Text
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSafeZone}
                    onChange={(e) => setShowSafeZone(e.target.checked)}
                    style={{ accentColor: "var(--primary)", width: 12, height: 12 }}
                  />
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Safe zones</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["reels", "shorts", "tiktok"] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all duration-300 ${
                    platform === p
                      ? "bg-[rgba(138,43,226,0.15)] border-[#8A2BE2] text-white shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                      : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className="text-xl">{PLATFORM_ICONS[p]}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest font-display">
                    {p}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ════ Right column — Controls ════ */}
        <div className="flex flex-col gap-6">
          {error && (
            <div className="p-4 rounded-xl bg-[rgba(255,42,95,0.1)] border border-[rgba(255,42,95,0.4)] flex gap-3 text-[#FF2A5F] text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="glass-panel p-6">
            <div className="label-section mb-5">Aspect Ratio Engine</div>
            <LayoutPicker
              value={[layout]}
              onChange={(vs) => {
                const next = vs.find((v) => v !== layout) ?? vs[vs.length - 1];
                if (next) changeLayout(next);
              }}
              singleSelect
            />
          </div>

          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <div className="label-section mb-3">Caption Placement</div>
                <div className="segmented-control w-full flex">
                  {(["top", "center", "bottom"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => {
                        setCaptionPos(pos);
                        setDirty(true);
                      }}
                      className={`segmented-btn flex-1 !text-xs ${captionPos === pos ? "active" : ""}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="label-section !mb-0">Typography Scale</span>
                  <span className="text-[#00F0FF] font-mono text-sm font-bold">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={fontSize}
                  onChange={(e) => {
                    setFontSize(Number(e.target.value));
                    setDirty(true);
                  }}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="label-section !mb-0">Words Per Line</span>
                  <span className="text-[#00F0FF] font-mono text-sm font-bold">{maxWords}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={maxWords}
                  onChange={(e) => {
                    setMaxWords(Number(e.target.value));
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="label-section mb-3">Hook Headline</div>
                <textarea
                  value={hookText}
                  onChange={(e) => {
                    setHookText(e.target.value);
                    setDirty(true);
                  }}
                  rows={2}
                  placeholder="Type an attention-grabbing hook..."
                  className="w-full"
                />
              </div>

              <div>
                <div className="label-section mb-3">Hook Emoji</div>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        setEmoji(e);
                        setDirty(true);
                      }}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        emoji === e
                          ? "bg-gradient-to-br from-[#00F0FF] to-[#8A2BE2] shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                          : "bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => {
                      setEmoji(e.target.value);
                      setDirty(true);
                    }}
                    maxLength={4}
                    className="w-14 text-center !px-1 !text-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Captions Editor ── */}
          <div className="glass-panel overflow-hidden flex flex-col min-h-[300px]">
            <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between bg-[rgba(10,10,15,0.4)]">
              <div className="label-section !mb-0 flex items-center gap-2">
                Transcription Editor
                {captions.length > 0 && (
                  <span className="bg-[rgba(255,255,255,0.1)] text-white px-2 py-0.5 rounded text-[9px]">
                    {captions.length} words
                  </span>
                )}
              </div>

              {!isEditingCaptions ? (
                <button
                  onClick={() => setIsEditingCaptions(true)}
                  disabled={captions.length === 0}
                  className="flex items-center gap-1.5 text-[#00F0FF] text-xs font-bold font-display uppercase tracking-wider hover:text-white transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Modify Text
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditingCaptions(false);
                      api.getCaptions(clip.clip_id).then(setCaptions).catch(console.error);
                    }}
                    className="flex items-center gap-1 text-gray-400 hover:text-white text-xs font-bold font-display uppercase tracking-wider transition-colors"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={saveCaptions}
                    disabled={savingCaptions}
                    className="btn-primary !px-4 !py-1.5 !text-xs !min-h-0"
                  >
                    {savingCaptions ? "Saving..." : "Save Transcript"}
                  </button>
                </div>
              )}
            </div>

            {captionsError && (
              <div className="p-3 bg-[rgba(255,42,95,0.1)] text-[#FF2A5F] text-xs font-medium text-center border-b border-[rgba(255,42,95,0.2)]">
                {captionsError}
              </div>
            )}

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-[rgba(0,0,0,0.2)]">
              {captions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 opacity-50">
                  <Edit2 className="w-8 h-8" />
                  <span className="text-sm">No transcription data available for this clip.</span>
                </div>
              ) : !isEditingCaptions ? (
                <div className="leading-relaxed text-[15px]">
                  {captions.map((w, idx) => {
                    const isActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <span
                        key={idx}
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = w.start;
                            videoRef.current.play().catch(() => {});
                          }
                        }}
                        className={`inline-block mx-[2px] my-[2px] px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 ${
                          isActive
                            ? "bg-[#00F0FF] text-black font-bold shadow-[0_0_10px_rgba(0,240,255,0.5)] transform scale-105"
                            : "text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.1)]"
                        }`}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {captions.map((w, idx) => {
                    const isActive = currentTime >= w.start && currentTime <= w.end;
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border transition-colors ${
                          isActive
                            ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF]"
                            : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.05)]"
                        }`}
                      >
                        <div className="text-[10px] text-gray-500 font-mono mb-1">
                          {w.start.toFixed(1)}s
                        </div>
                        <input
                          type="text"
                          value={w.text}
                          onChange={(e) => handleWordChange(idx, e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-white text-sm focus:ring-0 shadow-none font-medium"
                          style={{ boxShadow: "none" }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-[rgba(10,10,15,0.4)] border-t border-[rgba(255,255,255,0.05)] text-xs text-gray-500 font-medium flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              {!isEditingCaptions
                ? "Click any word to jump to that moment in the video."
                : "Edit words directly. Timestamp sync remains unchanged."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/clips"
      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors uppercase tracking-widest font-display"
    >
      <div className="w-8 h-8 rounded-full border border-[rgba(255,255,255,0.1)] flex items-center justify-center bg-[rgba(255,255,255,0.02)]">
        <ArrowLeft className="w-4 h-4" />
      </div>
      Back to Library
    </Link>
  );
}

function SafeZoneOverlay({ platform }: { platform: Platform }) {
  const z = SAFE_ZONES[platform];
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className="absolute inset-x-0 top-0 bg-[rgba(255,42,95,0.2)] backdrop-blur-[1px]"
        style={{ height: `${z.top}%` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 bg-[rgba(255,42,95,0.2)] backdrop-blur-[1px]"
        style={{ height: `${z.bottom}%` }}
      />
      <div
        className="absolute right-0 bg-[rgba(255,42,95,0.2)] backdrop-blur-[1px]"
        style={{ width: `${z.right}%`, top: `${z.top}%`, bottom: `${z.bottom}%` }}
      />
      <div
        className="absolute left-0 bg-[rgba(255,42,95,0.2)] backdrop-blur-[1px]"
        style={{ width: `${z.left}%`, top: `${z.top}%`, bottom: `${z.bottom}%` }}
      />
      <div
        className="absolute border border-dashed border-[#FF2A5F] opacity-70"
        style={{
          top: `${z.top}%`,
          bottom: `${z.bottom}%`,
          left: `${z.left}%`,
          right: `${z.right}%`,
        }}
      >
        <div className="absolute top-2 left-2 bg-[#FF2A5F] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
          {platform} Safe Zone
        </div>
      </div>
    </div>
  );
}

/* ── Caption Preview (Real-time Video Overlay) ── */
function CaptionPreview({
  captions,
  currentTime,
  maxWords,
  fontSize,
  position,
  template,
}: {
  captions: Array<{ text: string; start: number; end: number }>;
  currentTime: number;
  maxWords: number;
  fontSize: number;
  position: "top" | "center" | "bottom";
  template: string;
}) {
  // Find current active word index
  const activeIdx = captions.findIndex((w) => currentTime >= w.start && currentTime <= w.end);
  if (activeIdx === -1) return null;

  // Group into chunks of `maxWords`
  const chunks: Array<Array<{ text: string; start: number; end: number; originalIdx: number }>> =
    [];
  let currentChunk: any[] = [];
  captions.forEach((w, i) => {
    if (currentChunk.length >= maxWords) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push({ ...w, originalIdx: i });
  });
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const activeChunk = chunks.find((c) => c.some((w) => w.originalIdx === activeIdx));
  if (!activeChunk) return null;

  // Visual styling logic based on template
  const isUppercase = [
    "alex_hormozi",
    "mrbeast",
    "gaming",
    "motivational",
    "tiktok_viral",
    "cyberpunk",
    "news_flash",
    "y2k_bubbly",
    "comic_book",
    "comic_manga",
    "blueprint",
    "blueprint_hud",
    "street_graffiti",
  ].includes(template);
  const activeColor =
    {
      alex_hormozi: "#FFFF00",
      mrbeast: "#1AFF1A",
      iman_gadzhi: "#FFFF00",
      ali_abdaal: "#4285F4",
      podcast: "#FFFF00",
      gaming: "#FF00FF",
      motivational: "#FFA500",
      tiktok_viral: "#FF0000",
      premium_cinematic: "#FFD700",
      cyberpunk: "#FF00FF",
      hacker: "#FFFFFF",
      dreamy: "#FFB4FF",
      news_flash: "#FF0000",
      y2k_bubbly: "#FFFF00",
      comic_book: "#FFEB3B",
      typewriter: "#FFFFFF",
      liquid_glass: "#FFFFFF",
      blueprint: "#FFFFFF",
      street_graffiti: "#FF0055",
      luxury_marble: "#FFD700",
      comic_manga: "#FFFFFF",
      holographic: "#00FFFF",
      old_newspaper: "#000000",
      blueprint_hud: "#00FFFF",
    }[template] || "#FFFF00";

  const fontFam =
    {
      alex_hormozi: "Impact, sans-serif",
      mrbeast: "Impact, sans-serif",
      gaming: "Impact, sans-serif",
      motivational: "Impact, sans-serif",
      tiktok_viral: "Impact, sans-serif",
      iman_gadzhi: "Arial, sans-serif",
      podcast: "Arial, sans-serif",
      minimal_clean: "Arial, sans-serif",
      ali_abdaal: "Segoe UI, sans-serif",
      premium_cinematic: "Georgia, serif",
      cyberpunk: "Consolas, monospace",
      hacker: "Consolas, monospace",
      dreamy: "Comic Sans MS, cursive",
      y2k_bubbly: "Comic Sans MS, cursive",
      news_flash: "Trebuchet MS, sans-serif",
      comic_book: "Comic Sans MS, cursive, sans-serif",
      typewriter: "Courier New, Courier, monospace",
      liquid_glass: "Helvetica Neue, Helvetica, Arial, sans-serif",
      blueprint: "Consolas, monospace",
      street_graffiti: "Impact, sans-serif",
      luxury_marble: "Georgia, serif",
      comic_manga: "Impact, sans-serif",
      holographic: "Arial, sans-serif",
      old_newspaper: "Georgia, serif",
      blueprint_hud: "Consolas, monospace",
    }[template] || "Arial, sans-serif";

  // Base alignment logic
  const topPos = position === "top" ? "15%" : position === "center" ? "50%" : "auto";
  const bottomPos = position === "bottom" ? "15%" : "auto";
  const transformPos = position === "center" ? "translate(-50%, -50%)" : "translateX(-50%)";

  // Scale the ASS font size down to browser relative size (roughly font/10 in vh)
  const scaledSize = Math.max(16, fontSize * 0.4);

  // Compute overall styles
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: topPos,
    bottom: bottomPos,
    transform: transformPos,
    textAlign: "center",
    fontFamily: fontFam,
    fontSize: `${scaledSize}px`,
    lineHeight: 1.2,
    fontWeight: 900,
    width: "90%",
    pointerEvents: "none",
    zIndex: 30,
    textTransform: isUppercase ? "uppercase" : "none",
  };

  if (template === "podcast" || template === "hacker" || template === "news_flash") {
    containerStyle.background = "rgba(0,0,0,0.8)";
    containerStyle.padding = "8px 16px";
    containerStyle.borderRadius = "8px";
    containerStyle.display = "inline-block";
    containerStyle.width = "auto";
  } else if (template === "liquid_glass") {
    containerStyle.background = "rgba(255,255,255,0.1)";
    containerStyle.backdropFilter = "blur(12px)";
    containerStyle.padding = "12px 24px";
    containerStyle.borderRadius = "16px";
    containerStyle.border = "1px solid rgba(255,255,255,0.2)";
    containerStyle.display = "inline-block";
    containerStyle.width = "auto";
  } else if (template === "blueprint") {
    containerStyle.background = "#0d47a1";
    containerStyle.backgroundImage = "linear-gradient(#1565c0 1px, transparent 1px), linear-gradient(90deg, #1565c0 1px, transparent 1px)";
    containerStyle.backgroundSize = "20px 20px";
    containerStyle.padding = "12px 24px";
    containerStyle.border = "2px solid #64b5f6";
    containerStyle.display = "inline-block";
    containerStyle.width = "auto";
  } else if (template === "old_newspaper") {
    containerStyle.background = "#f4ecd8";
    containerStyle.padding = "12px 24px";
    containerStyle.border = "1px solid #dcd0b8";
    containerStyle.display = "inline-block";
    containerStyle.width = "auto";
    containerStyle.boxShadow = "inset 0 0 20px rgba(0,0,0,0.1)";
  } else if (template === "blueprint_hud") {
    containerStyle.background = "rgba(0,255,255,0.05)";
    containerStyle.padding = "8px 16px";
    containerStyle.borderLeft = "2px solid #00FFFF";
    containerStyle.borderRight = "2px solid #00FFFF";
    containerStyle.display = "inline-block";
    containerStyle.width = "auto";
  }

  // Helper for text shadow based on template
  const getTextShadow = (isActive: boolean) => {
    if (template === "minimal_clean" || template === "typewriter" || template === "blueprint" || template === "old_newspaper") return "none";
    if (template === "mrbeast")
      return "0px 0px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 6px 0px rgba(0,0,0,1)";
    if (template === "comic_book")
      return "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 4px 4px 0 #000";
    if (template === "comic_manga")
      return "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000";
    if (template === "street_graffiti")
      return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 5px rgba(255,0,85,0.8)";
    if (template === "luxury_marble")
      return "1px 1px 2px rgba(0,0,0,0.5)";
    if (template === "liquid_glass")
      return "0 2px 10px rgba(255,255,255,0.5)";
    if (template === "holographic")
      return "0 0 5px #00FFFF, 0 0 10px #FF00FF, 0 0 20px #FF00FF";
    if (template === "blueprint_hud")
      return "0 0 5px #00FFFF, 0 0 10px #00FFFF";
    if (template === "gaming")
      return isActive ? "0 0 10px #FF00FF, 0 0 20px #FF00FF" : "0 0 10px #00FFFF";
    if (template === "cyberpunk")
      return isActive ? "2px 2px 0px #FF0000, -2px -2px 0px #00FFFF" : "none";
    if (template === "podcast" || template === "hacker" || template === "news_flash") return "none";
    // default thick outline
    return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 4px 6px rgba(0,0,0,0.8)";
  };

  const getAnimationClass = (isActive: boolean) => {
    if (!isActive) return "";
    switch (template) {
      case "alex_hormozi":
      case "comic_book":
        return "animate-popin";
      case "tiktok_viral":
        return "animate-popin-fast";
      case "mrbeast":
      case "street_graffiti":
        return "animate-bounce-sub";
      case "motivational":
      case "comic_manga":
        return "animate-zoom";
      case "gaming":
        return "animate-shake";
      case "cyberpunk":
      case "holographic":
        return "animate-glitch";
      case "y2k_bubbly":
        return "animate-rotate-in";
      case "dreamy":
      case "liquid_glass":
        return "animate-pulse-sub";
      case "ali_abdaal":
      case "luxury_marble":
      case "typewriter":
      case "old_newspaper":
        return "animate-fade-scale";
      default:
        return "";
    }
  };

  const getTextColor = (isActive: boolean, text: string) => {
    if (!isActive) {
      if (template === "gaming") return "#00FFFF";
      if (template === "cyberpunk" || template === "hacker") return "#00FF00";
      if (template === "blueprint_hud") return "#88FFFF";
      if (template === "old_newspaper") return "#333333";
      if (template === "typewriter" || template === "comic_manga") return "#FFFFFF";
      return "#FFFFFF";
    }
    // Is active
    if (template === "iman_gadzhi") {
      // Keyword only
      if (text.length >= 7) return activeColor;
      return "#FFFFFF";
    }
    if (template === "minimal_clean" || template === "typewriter" || template === "comic_manga") return "#FFFFFF";
    if (template === "old_newspaper") return "#000000";
    return activeColor;
  };

  return (
    <div style={containerStyle} className="caption-preview-container">
      {activeChunk.map((w, idx) => {
        const isActive = w.originalIdx === activeIdx;
        return (
          <span
            key={w.originalIdx}
            className={`inline-block mx-[4px] transition-colors duration-100 ${getAnimationClass(isActive)}`}
            style={{
              color: getTextColor(isActive, w.text),
              textShadow: getTextShadow(isActive),
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
