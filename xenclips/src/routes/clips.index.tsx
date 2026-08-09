import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Film, AlertTriangle, Sparkles, ChevronRight, Search, RotateCcw } from "lucide-react";
import { api, getCurrentJob, setCurrentJob, type Clip } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clips/")({
  component: ClipsGrid,
});

const LAYOUT_LABELS: Record<string, string> = {
  full_vertical: "Vertical AI",
  bw_letterbox: "Cinematic",
  blur_bg: "Aura Blur",
  streamer: "Streamer",
  original: "Raw Format",
};
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

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ══ Clips Grid Page ══════════════════════════════════════════ */
function ClipsGrid() {
  const [jobId, setJobId] = useState<string>(() => getCurrentJob() || "");
  const [inputJobId, setInputJobId] = useState(jobId);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setClips(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .clips(jobId)
      .then((c) => {
        if (!cancelled) setClips(c);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const loadJob = () => {
    const v = inputJobId.trim();
    if (!v) return;
    setCurrentJob(v);
    setJobId(v);
  };

  return (
    <div className="p-8 pb-20 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="font-display text-[2.5rem] font-bold tracking-tight mb-2 text-white">
              Generated <span className="text-gradient">Library</span>
            </h1>
            {jobId && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF] animate-pulse" />
                <span className="font-mono text-xs text-gray-400 uppercase">Session: {jobId}</span>
              </div>
            )}
          </div>

          {/* Job ID lookup */}
          <div className="flex items-center gap-2">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] rounded-full opacity-20 group-hover:opacity-40 transition duration-500 blur" />
              <div className="relative flex bg-[rgba(10,10,15,0.7)] border border-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                <div className="pl-4 pr-2 flex items-center">
                  <Search className="w-4 h-4 text-[#00F0FF]" />
                </div>
                <input
                  type="text"
                  placeholder="Load Job ID..."
                  value={inputJobId}
                  onChange={(e) => setInputJobId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadJob()}
                  className="w-40 py-2.5 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 text-sm font-medium"
                />
              </div>
            </div>
            <button onClick={loadJob} className="btn-primary !px-5 !py-2.5">
              Load
            </button>
          </div>
        </div>

        {/* ── States ── */}
        {!jobId && (
          <EmptyState
            title="No Active Session"
            desc="Navigate to the Upload tab to synthesize a new video, or enter a valid Job ID above."
            icon="upload"
          />
        )}
        {error && (
          <div className="p-6 rounded-2xl bg-[rgba(255,42,95,0.1)] border border-[rgba(255,42,95,0.4)] flex gap-4 items-start shadow-[0_10px_30px_rgba(255,42,95,0.15)]">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,42,95,0.2)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#FF2A5F]" />
            </div>
            <div>
              <h4 className="text-[#FF2A5F] font-bold text-lg mb-1">Failed to Load</h4>
              <p className="text-sm text-[rgba(255,255,255,0.7)]">{error}</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="premium-spinner w-8 h-8 border-4" />
            <span className="text-sm text-gray-400 font-display uppercase tracking-widest font-semibold">
              Retrieving Clips...
            </span>
          </div>
        )}
        {clips && clips.length === 0 && (
          <EmptyState
            title="Zero Results"
            desc="The AI engine could not extract any viable clips from this media."
            icon="film"
          />
        )}
        {clips && clips.length > 0 && <GroupedClips clips={clips} />}
      </div>
    </div>
  );
}

/* ── Grouped clip sections ─────────────────────────────────── */
function GroupedClips({ clips }: { clips: Clip[] }) {
  const groups = new Map<string | number, Clip[]>();
  for (const c of clips) {
    const key = c.clip_number != null ? c.clip_number : `c:${c.clip_id}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const entries = Array.from(groups.entries()).sort((a, b) => {
    const an = typeof a[0] === "number" ? a[0] : Number.MAX_SAFE_INTEGER;
    const bn = typeof b[0] === "number" ? b[0] : Number.MAX_SAFE_INTEGER;
    return an - bn;
  });

  return (
    <div className="space-y-10">
      {entries.map(([key, items], idx) => {
        const label =
          typeof key === "number"
            ? `Sequence ${key.toString().padStart(2, "0")}`
            : `Sequence ${String(idx + 1).padStart(2, "0")}`;
        const first = items[0];
        return <ClipGroup key={String(key)} label={label} items={items} first={first} />;
      })}
    </div>
  );
}

/* ── Single clip group ──────────────────────────────────────── */
function ClipGroup({ label, items, first }: { label: string; items: Clip[]; first: Clip }) {
  const layouts = [...new Set(items.map((c) => c.layout).filter(Boolean))];
  const templates = [...new Set(items.map((c) => c.template).filter(Boolean))];

  const [activeLayout, setActiveLayout] = useState<string>(layouts[0] ?? "");
  const [activeTemplate, setActiveTemplate] = useState<string>(templates[0] ?? "");

  const filtered = items.filter(
    (c) =>
      (!activeLayout || c.layout === activeLayout) &&
      (!activeTemplate || c.template === activeTemplate),
  );

  return (
    <div className="glass-panel overflow-hidden transition-all duration-500 hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)] hover:border-[rgba(255,255,255,0.15)] group">
      {/* Group header */}
      <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-display text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-white uppercase tracking-wider">
              {label}
            </span>
            {first?.reaction_moment && (
              <span className="badge-glow flex items-center gap-1.5 px-2.5 py-1">
                <Sparkles className="w-3 h-3" />
                Reaction
              </span>
            )}
            {first?.duration && (
              <span className="bg-[rgba(255,255,255,0.05)] text-gray-300 px-2 py-0.5 rounded font-mono text-xs border border-[rgba(255,255,255,0.1)]">
                {formatDuration(first.duration)}
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-gray-400 text-sm font-medium">
            {first?.emoji && <span className="mr-2 text-base">{first.emoji}</span>}
            {first?.hook_text || "No transcription available."}
          </p>
        </div>

        <div className="text-xs font-semibold text-gray-500 bg-[rgba(255,255,255,0.03)] px-3 py-1.5 rounded-full border border-[rgba(255,255,255,0.05)] whitespace-nowrap">
          {items.length} Variation{items.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-6 py-3 flex items-center gap-6 flex-wrap bg-[rgba(20,20,25,0.2)] border-b border-[rgba(255,255,255,0.03)]">
        {layouts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-display">
              Aspect:
            </span>
            <div className="segmented-control !p-1">
              {layouts.map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLayout(l ?? "")}
                  className={`segmented-btn !py-1 !px-3 !text-xs ${activeLayout === l ? "active" : ""}`}
                >
                  {LAYOUT_LABELS[l ?? ""] ?? l}
                </button>
              ))}
            </div>
          </div>
        )}

        {templates.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-display">
              Style:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTemplate(t ?? "")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 border ${
                    activeTemplate === t
                      ? "bg-[rgba(138,43,226,0.2)] border-[#8A2BE2] text-[#D68AFF] shadow-[0_0_10px_rgba(138,43,226,0.3)]"
                      : "bg-transparent border-[rgba(255,255,255,0.1)] text-gray-400 hover:border-[rgba(255,255,255,0.3)] hover:text-white"
                  }`}
                >
                  {TEMPLATE_LABELS[t ?? ""] ?? t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clip grid */}
      <div className="p-6">
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {filtered.map((c) => (
            <ClipCard key={c.clip_id} clip={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Clip card ──────────────────────────────────────────────── */
function ClipCard({ clip }: { clip: Clip }) {
  return (
    <Link
      to="/clips/$clipId"
      params={{ clipId: clip.clip_id }}
      data-testid={`clip-card-${clip.clip_id}`}
      className="block shrink-0 group/card"
    >
      <div className="relative w-[140px] rounded-xl overflow-hidden transition-all duration-300 transform group-hover/card:-translate-y-2 group-hover/card:shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
        {/* Glowing border effect on hover */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#00F0FF] to-[#8A2BE2] opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
          style={{ padding: 1, borderRadius: 12 }}
        >
          <div className="w-full h-full bg-[rgba(20,20,25,0.9)] rounded-[11px]" />
        </div>

        <div className="relative flex flex-col h-full rounded-xl border border-[rgba(255,255,255,0.1)] group-hover/card:border-transparent transition-colors duration-300 bg-[rgba(20,20,25,0.6)] backdrop-blur-sm z-10 overflow-hidden">
          {/* Poster/thumbnail */}
          <div className="relative aspect-[9/16] bg-[rgba(10,10,15,0.8)] overflow-hidden">
            {clip.failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(255,42,95,0.05)] text-[#FF2A5F]">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-80" />
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">
                  Render Error
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="w-8 h-8 text-[rgba(255,255,255,0.1)] group-hover/card:scale-110 transition-transform duration-500" />
              </div>
            )}

            {/* Hover Play Overlay */}
            {!clip.failed && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                <div className="w-10 h-10 rounded-full bg-[#00F0FF] flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.6)] transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300">
                  <ChevronRight className="w-5 h-5 text-black ml-0.5" />
                </div>
              </div>
            )}

            {/* Duration badge */}
            {clip.duration && (
              <div className="absolute bottom-2 right-2 font-mono text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded backdrop-blur-md border border-[rgba(255,255,255,0.1)]">
                {formatDuration(clip.duration)}
              </div>
            )}

            {/* Reaction badge */}
            {clip.reaction_moment && (
              <div className="absolute top-2 left-2 badge-glow flex items-center gap-1 !px-1.5 !py-0.5 !text-[9px]">
                <Sparkles className="w-2.5 h-2.5" />
              </div>
            )}
          </div>

          {/* Info strip */}
          <div className="p-2.5 border-t border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.2)]">
            <div className="font-display text-[10px] font-bold tracking-widest text-white uppercase truncate mb-0.5">
              {LAYOUT_LABELS[clip.layout ?? ""] ?? clip.layout}
            </div>
            <div className="text-[10px] text-gray-500 truncate font-medium">
              {TEMPLATE_LABELS[clip.template ?? ""] ?? clip.template}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptyState({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: "film" | "upload";
}) {
  return (
    <div className="glass-panel p-16 flex flex-col items-center text-center border-dashed border-2 border-[rgba(255,255,255,0.1)]">
      <div className="w-20 h-20 rounded-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] flex items-center justify-center mb-6">
        {icon === "upload" ? (
          <RotateCcw className="w-8 h-8 text-gray-600" />
        ) : (
          <Film className="w-8 h-8 text-gray-600" />
        )}
      </div>
      <h3 className="font-display text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm max-w-sm mb-8">{desc}</p>

      {icon === "upload" && (
        <Link to="/" className="btn-primary">
          Open Studio Engine
        </Link>
      )}
    </div>
  );
}
