import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Upload as UploadIcon,
  Link as LinkIcon,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronDown,
  Film,
  Zap,
  Bookmark,
  Save,
  Clock,
  Timer,
  Lock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  api,
  setCurrentJob,
  getSettings,
  type JobStatus,
  type ProcessingStep,
  type LayoutTemplate,
  type CaptionTemplate,
  type CaptionPosition,
} from "@/lib/api";
import { LayoutPicker } from "@/components/layout-picker";
import { Switch } from "@/components/ui/switch";
import { useShortcuts } from "@/hooks/use-shortcuts";

export const Route = createFileRoute("/")({ component: UploadPage });

/* ── Processing steps definition ─────────────────────────────── */
const STEPS: { key: ProcessingStep; label: string; aliases?: string[] }[] = [
  { key: "downloading", label: "Downloading Media", aliases: [] },
  { key: "transcript", label: "Generating Transcript", aliases: ["transcribing"] },
  { key: "finding_viral", label: "Analyzing Highlights", aliases: ["detecting"] },
  { key: "cutting_raw", label: "Trimming Clips", aliases: ["cutting"] },
  { key: "transcribing_whisper", label: "Whisper Audio Sync" },
  { key: "correcting_hinglish", label: "Correcting Hinglish" },
  { key: "subtitles", label: "Baking Subtitles" },
  { key: "rendering", label: "Finalizing Renders" },
];

/* ── Caption templates ────────────────────────────────────────── */
const CAPTION_TEMPLATES: {
  value: CaptionTemplate;
  label: string;
  hint: string;
}[] = [
  { value: "alex_hormozi", label: "Alex Hormozi", hint: "Bold uppercase, yellow active word" },
  { value: "mrbeast", label: "MrBeast", hint: "Thick outline, bright green" },
  { value: "iman_gadzhi", label: "Iman Gadzhi", hint: "Minimal, yellow keyword highlights" },
  { value: "ali_abdaal", label: "Ali Abdaal", hint: "Rounded, blue highlight, fade+scale" },
  { value: "podcast", label: "Podcast", hint: "White on black box, word-by-word" },
  { value: "gaming", label: "Gaming", hint: "Neon cyan/purple glow, shake" },
  { value: "motivational", label: "Motivational", hint: "Huge bold, orange/gold, zoom" },
  { value: "minimal_clean", label: "Minimal Clean", hint: "Phrase-level fade, no outline" },
  { value: "tiktok_viral", label: "TikTok Viral", hint: "Bold uppercase, red pop, emoji" },
  { value: "premium_cinematic", label: "Premium Cinematic", hint: "Elegant, gold, blur-to-sharp" },
  { value: "cyberpunk", label: "Cyberpunk", hint: "Glitch text, cyan/pink neon" },
  { value: "hacker", label: "Hacker Terminal", hint: "Monospace green on black" },
  { value: "dreamy", label: "Dreamy Cloud", hint: "Pastel colors, soft pulsing" },
  { value: "news_flash", label: "News Flash", hint: "Breaking news ticker style" },
  { value: "y2k_bubbly", label: "Y2K Bubbly", hint: "Bubbly font, pink gradient rotate" },
  {
    value: "comic_book",
    label: "Comic Book",
    hint: "Bold comic font, halftone shadow, punch animation",
  },
  {
    value: "typewriter",
    label: "Typewriter",
    hint: "Characters appear one by one with a blinking cursor",
  },
  { value: "liquid_glass", label: "Liquid Glass", hint: "Glassmorphism background, soft blur" },
  { value: "blueprint", label: "Blueprint", hint: "Blueprint blue background, technical font" },
  {
    value: "street_graffiti",
    label: "Street Graffiti",
    hint: "Spray-paint font, rough outline, bounce",
  },
  { value: "luxury_marble", label: "Luxury Marble", hint: "White marble texture, gold serif text" },
  {
    value: "comic_manga",
    label: "Comic Manga",
    hint: "Black & white manga style, dramatic impact",
  },
  { value: "holographic", label: "Holographic", hint: "Iridescent gradient text, glow effect" },
  { value: "old_newspaper", label: "Old Newspaper", hint: "Vintage newspaper font, sepia tones" },
  {
    value: "blueprint_hud",
    label: "Blueprint HUD",
    hint: "Sci-fi HUD overlays, cyan technical labels",
  },
];

const MIN_TEMPLATES = 1;
const MAX_TEMPLATES = 3;

/* ── Helpers ─────────────────────────────────────────────────── */
function stepIndexFor(step: string | undefined, progress: number | undefined) {
  if (!step) return 0;
  const lower = step.toLowerCase();
  if (lower === "done") return STEPS.length;
  const i = STEPS.findIndex((s) => s.key === lower || (s.aliases ?? []).includes(lower));
  if (i >= 0) return i;
  const p = progress ?? 0;
  if (p >= 100) return STEPS.length;
  return Math.min(STEPS.length - 1, Math.max(0, Math.floor((p / 100) * STEPS.length)));
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACTIVE_JOB_KEY = "clipper.activeJobId";
function saveActiveJob(jobId: string) {
  localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId, ts: Date.now() }));
  setCurrentJob(jobId);
}
function loadActiveJob(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw).jobId || null;
  } catch {
    return null;
  }
}
function clearActiveJob() {
  localStorage.removeItem(ACTIVE_JOB_KEY);
}

/* ══ Page Component ════════════════════════════════════════════ */
function UploadPage() {
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);



  const [layouts, setLayouts] = useState<LayoutTemplate[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("upload.layouts");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [getSettings().default_layout];
  });
  const [templates, setTemplates] = useState<CaptionTemplate[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("upload.templates");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return ["alex_hormozi"];
  });
  const [captionsOn, setCaptionsOn] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("upload.captionsOn");
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const [position, setPosition] = useState<CaptionPosition>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("upload.position") as CaptionPosition) || "bottom";
    }
    return "bottom";
  });
  const [hookStyle, setHookStyle] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("upload.hookStyle") || "default";
    }
    return "default";
  });
  const [clipVibe, setClipVibe] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("upload.clipVibe") || "viral";
    }
    return "viral";
  });
  const [hookVibe, setHookVibe] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("upload.hookVibe") || "clickbait";
    }
    return "clickbait";
  });
  const [hookLang, setHookLang] = useState<"auto" | "english" | "hinglish">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("upload.hookLang") as any) || "auto";
    }
    return "auto";
  });
  const [creatorNameEnabled, setCreatorNameEnabled] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("upload.creatorNameEnabled") === "true";
    return false;
  });
  const [creatorName, setCreatorName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("upload.creatorName") || "";
    return "";
  });
  const [maxWordsOn, setMaxWordsOn] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("upload.maxWordsOn") === "true";
    return false;
  });
  const [maxWords, setMaxWords] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.maxWords") || "4");
    return 4;
  });
  const [fontSizeOn, setFontSizeOn] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("upload.fontSizeOn") === "true";
    return false;
  });
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.fontSize") || "48");
    return 48;
  });
  const [numClips, setNumClips] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.numClips") || "6");
    return 6;
  });
  const [fadeEnabled, setFadeEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("upload.fadeEnabled");
      if (saved != null) return saved === "true";
    }
    return true;
  });

  const [smartZoomEnabled, setSmartZoomEnabled] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("upload.smartZoomEnabled") === "true";
    return false;
  });
  const [smartZoomStyle, setSmartZoomStyle] = useState<
    "smooth" | "punch" | "cinematic" | "dynamic"
  >(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("upload.smartZoomStyle") as any) || "dynamic";
    return "dynamic";
  });
  const [smartZoomIntensity, setSmartZoomIntensity] = useState<"low" | "medium" | "high">(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("upload.smartZoomIntensity") as any) || "medium";
    return "medium";
  });
  const [speedRampEnabled, setSpeedRampEnabled] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("upload.speedRampEnabled") === "true";
    return false;
  });
  const [speedRampMax, setSpeedRampMax] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.speedRampMax") || "1.20");
    return 1.2;
  });

  useEffect(() => {
    localStorage.setItem("upload.layouts", JSON.stringify(layouts));
  }, [layouts]);
  useEffect(() => {
    localStorage.setItem("upload.templates", JSON.stringify(templates));
  }, [templates]);
  useEffect(() => {
    localStorage.setItem("upload.captionsOn", String(captionsOn));
  }, [captionsOn]);
  useEffect(() => {
    localStorage.setItem("upload.position", position);
  }, [position]);
  useEffect(() => {
    localStorage.setItem("upload.hookStyle", hookStyle);
  }, [hookStyle]);
  useEffect(() => {
    localStorage.setItem("upload.clipVibe", clipVibe);
  }, [clipVibe]);
  useEffect(() => {
    localStorage.setItem("upload.hookVibe", hookVibe);
  }, [hookVibe]);
  useEffect(() => {
    localStorage.setItem("upload.hookLang", hookLang);
  }, [hookLang]);
  useEffect(() => {
    localStorage.setItem("upload.creatorNameEnabled", String(creatorNameEnabled));
  }, [creatorNameEnabled]);
  useEffect(() => {
    localStorage.setItem("upload.creatorName", creatorName);
  }, [creatorName]);
  useEffect(() => {
    localStorage.setItem("upload.maxWordsOn", String(maxWordsOn));
  }, [maxWordsOn]);
  useEffect(() => {
    localStorage.setItem("upload.maxWords", String(maxWords));
  }, [maxWords]);
  useEffect(() => {
    localStorage.setItem("upload.fontSizeOn", String(fontSizeOn));
  }, [fontSizeOn]);
  useEffect(() => {
    localStorage.setItem("upload.fontSize", String(fontSize));
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem("upload.numClips", String(numClips));
  }, [numClips]);
  useEffect(() => {
    localStorage.setItem("upload.fadeEnabled", String(fadeEnabled));
  }, [fadeEnabled]);

  useEffect(() => {
    localStorage.setItem("upload.smartZoomEnabled", String(smartZoomEnabled));
  }, [smartZoomEnabled]);
  useEffect(() => {
    localStorage.setItem("upload.smartZoomStyle", smartZoomStyle);
  }, [smartZoomStyle]);
  useEffect(() => {
    localStorage.setItem("upload.smartZoomIntensity", smartZoomIntensity);
  }, [smartZoomIntensity]);
  useEffect(() => {
    localStorage.setItem("upload.speedRampEnabled", String(speedRampEnabled));
  }, [speedRampEnabled]);
  useEffect(() => {
    localStorage.setItem("upload.speedRampMax", String(speedRampMax));
  }, [speedRampMax]);

  const [watermarksOpen, setWatermarksOpen] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("upload.watermarkEnabled") === "true";
    return false;
  });
  const [watermarkType, setWatermarkType] = useState<"png" | "svg" | "text" | "logo_text">(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("upload.watermarkType") as any) || "text";
    return "text";
  });
  const [watermarkText, setWatermarkText] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("upload.watermarkText") || "XenClips";
    return "XenClips";
  });
  const [watermarkPosition, setWatermarkPosition] = useState<
    "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center"
  >(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("upload.watermarkPosition") as any) || "bottom_right";
    return "bottom_right";
  });
  const [watermarkOpacity, setWatermarkOpacity] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.watermarkOpacity") || "80");
    return 80;
  });
  const [watermarkScale, setWatermarkScale] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.watermarkScale") || "25");
    return 25;
  });
  const [watermarkMargin, setWatermarkMargin] = useState(() => {
    if (typeof window !== "undefined")
      return Number(localStorage.getItem("upload.watermarkMargin") || "5");
    return 5;
  });
  const [watermarkAnimation, setWatermarkAnimation] = useState<
    "none" | "fade_in" | "fade_out" | "slide_in"
  >(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("upload.watermarkAnimation") as any) || "fade_in";
    return "fade_in";
  });
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);

  useEffect(() => {
    localStorage.setItem("upload.watermarkEnabled", String(watermarkEnabled));
  }, [watermarkEnabled]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkType", watermarkType);
  }, [watermarkType]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkText", watermarkText);
  }, [watermarkText]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkPosition", watermarkPosition);
  }, [watermarkPosition]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkOpacity", String(watermarkOpacity));
  }, [watermarkOpacity]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkScale", String(watermarkScale));
  }, [watermarkScale]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkMargin", String(watermarkMargin));
  }, [watermarkMargin]);
  useEffect(() => {
    localStorage.setItem("upload.watermarkAnimation", watermarkAnimation);
  }, [watermarkAnimation]);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [smartEnhancementsOpen, setSmartEnhancementsOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInterruptDialog, setShowInterruptDialog] = useState(false);
  const pollRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const { shortcuts, matchesShortcut } = useShortcuts();

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (jobId || submitting) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [jobId, submitting]);

  useEffect(() => {
    const saved = loadActiveJob();
    if (saved) setJobId(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!jobId) return;
      try {
        const s = await api.status(jobId);
        if (cancelled) return;
        setStatus(s);
        if (s.step === "Completed" || s.step === "Done" || s.step === "Failed") {
          setSubmitting(false);
        } else {
          pollRef.current = window.setTimeout(tick, 1000);
        }
      } catch (e) {
        if (!cancelled) console.error("Poll error:", e);
      }
    };
    if (jobId) {
      tick();
    }
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [jobId]);

  const templatesValid = !captionsOn || templates.length >= MIN_TEMPLATES;
  const layoutsValid = layouts.length >= 1;
  const hasInput = url.trim().length > 0 || file != null;
  const canSubmit = hasInput && !submitting && !jobId && templatesValid && layoutsValid;
  const includesSmartCrop = layouts.includes("full_vertical");
  const estClips = numClips;
  const estTotal = estClips * layouts.length * (captionsOn ? templates.length : 1);
  const current = stepIndexFor(status?.step, status?.progress);

  // ETA estimation (seconds) based on clip count and settings
  const getEstimateSecs = () => {
    const downloadSec = inputMode === "url" ? 60 : 10;
    const transcriptSec = 30; // Gemini full-video transcript
    const whisperPerClip = 60; // Faster-Whisper large-v3-turbo @ int8 CPU
    const renderPerVariant = 30; // FFmpeg render per layout×template combo
    const variants = layouts.length * (captionsOn ? templates.length : 1);
    return downloadSec + transcriptSec + (whisperPerClip * numClips) + (renderPerVariant * numClips * variants);
  };

  const totalEstSec = getEstimateSecs();
  const remainingSec = Math.max(0, totalEstSec - elapsedSec);

  const fmtTime = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  };


  const submit = async () => {
    setError(null);
    setSubmitting(true);
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    try {
      const opts = {
        layouts,
        templates,
        position,
        hook_style: hookStyle,
        clip_vibe: clipVibe,
        hook_vibe: hookVibe,
        hook_lang: hookLang,
        ...(creatorNameEnabled && creatorName.trim() ? { creator_name: creatorName.trim() } : {}),
        max_words: maxWordsOn ? maxWords : undefined,
        generate_captions: captionsOn,
        num_clips: numClips,
        fade_enabled: fadeEnabled,
        ...(maxWordsOn ? { max_words: maxWords } : {}),
        ...(fontSizeOn ? { font_size: fontSize } : {}),
        ...(smartZoomEnabled
          ? {
              smart_zoom_enabled: true,
              smart_zoom_style: smartZoomStyle,
              smart_zoom_intensity: smartZoomIntensity,
            }
          : {}),
        ...(speedRampEnabled
          ? {
              speed_ramp_enabled: true,
              speed_ramp_max: speedRampMax,
            }
          : {}),
        ...(watermarkEnabled
          ? {
              watermark_enabled: true,
              watermark_type: watermarkType,
              watermark_text: watermarkText,
              watermark_position: watermarkPosition,
              watermark_opacity: watermarkOpacity,
              watermark_scale: watermarkScale,
              watermark_margin: watermarkMargin,
              watermark_animation: watermarkAnimation,
              ...(watermarkFile ? { watermark_file: watermarkFile } : {}),
            }
          : {}),
      };
      const res = file
        ? await api.processFile(file, opts)
        : await api.process({ url: url.trim(), ...opts });
      saveActiveJob(res.job_id);
      setJobId(res.job_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Intercept shortcuts (placed here to access canSubmit and submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, "interruptProcessing")) {
        if (jobId || submitting) {
          e.preventDefault();
          setShowInterruptDialog(true);
        }
      } else if (matchesShortcut(e, "submitJob")) {
        if (canSubmit) {
          e.preventDefault();
          submit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jobId, submitting, matchesShortcut, canSubmit]);

  // Elapsed timer — ticks every second while job is running
  useEffect(() => {
    if (!jobId || status?.step === "Completed" || status?.step === "Done" || status?.step === "Failed") return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [jobId, status?.step]);

  const reset = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    clearActiveJob();
    setJobId(null);
    setStatus(null);
    setError(null);
    setUrl("");
    setFile(null);
  };

  const toggleTemplate = (t: CaptionTemplate) => {
    setTemplates([t]);
  };

  /* ══ Render: Processing view ═══════════════════════════════ */
  if (jobId) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] animate-fade-in-up">
        <div className="w-full glass-panel p-10 flex flex-col items-center text-center">
          <div className="relative mb-8">
            {status?.step === "Failed" ? (
              <div className="w-24 h-24 rounded-full bg-[#FF2A5F]/20 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-12 h-12 text-[#FF2A5F]" />
              </div>
            ) : status?.step === "Completed" || status?.step === "Done" ? (
              <div className="w-24 h-24 rounded-full bg-[#1AFF1A]/20 flex items-center justify-center animate-pulse">
                <CheckCircle2 className="w-12 h-12 text-[#1AFF1A]" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-[rgba(255,255,255,0.1)] border-t-[#00F0FF] animate-spin" />
            )}
            {!(
              status?.step === "Failed" ||
              status?.step === "Completed" ||
              status?.step === "Done"
            ) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#00F0FF] animate-pulse" />
              </div>
            )}
          </div>

          <h2 className="text-3xl font-display font-bold mb-3 tracking-tight text-white">
            {status?.step === "Failed"
              ? "Generation Failed"
              : status?.step === "Completed" || status?.step === "Done"
                ? "Ready for Export"
                : "Synthesizing Video"}
          </h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            {status?.step === "Failed"
              ? status.error || "An unknown error occurred during generation."
              : status?.step === "Completed" || status?.step === "Done"
                ? "Your clips have been successfully generated and are ready for review."
                : "Our AI engine is currently processing your request. This may take a few minutes depending on the video length."}
          </p>

          <div className="w-full max-w-md bg-[rgba(0,0,0,0.4)] rounded-full h-3 mb-6 overflow-hidden border border-[rgba(255,255,255,0.05)]">
            <div
              className="bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] h-full transition-all duration-700 ease-out relative"
              style={{ width: `${status?.progress || 0}%` }}
            >
              <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-shimmer" />
            </div>
          </div>

          {/* ── ETA Widget ── */}
          {status?.step !== "Completed" && status?.step !== "Done" && status?.step !== "Failed" && (
            <div
              className="w-full max-w-md mb-6 rounded-2xl overflow-hidden"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* header */}
              <div
                className="flex items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
              >
                <Timer className="w-3.5 h-3.5" style={{ color: "#00F0FF" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>
                  TIME ESTIMATE
                </span>
              </div>
              {/* stats row */}
              <div className="grid grid-cols-3 divide-x" style={{ divideColor: "rgba(255,255,255,0.05)" }}>
                {[
                  { label: "Elapsed", value: fmtTime(elapsedSec), color: "#E4E4E7" },
                  { label: "Estimated", value: fmtTime(totalEstSec), color: "#00F0FF" },
                  { label: "Remaining", value: remainingSec <= 5 ? "Almost done" : fmtTime(remainingSec), color: elapsedSec > totalEstSec ? "#FFA500" : "#8A2BE2" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center py-3 px-2">
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</span>
                  </div>
                ))}
              </div>
              {/* breakdown */}
              <div
                className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" }}
              >
                {[
                  { label: inputMode === "url" ? "Download" : "Load", sec: inputMode === "url" ? 60 : 10 },
                  { label: "AI Transcript", sec: 30 },
                  { label: `Whisper ×${numClips}`, sec: 60 * numClips },
                  { label: `Render ×${numClips * layouts.length * (captionsOn ? templates.length : 1)}`, sec: 30 * numClips * layouts.length * (captionsOn ? templates.length : 1) },
                ].map(({ label, sec }) => (
                  <span key={label} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    {label} <span style={{ color: "rgba(255,255,255,0.6)" }}>~{fmtTime(sec)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full max-w-md">
            {STEPS.map((s, i) => {
              const stepIdx = STEPS.findIndex((x) => x.key === s.key);
              const currentIdx = current;

              const isPast = currentIdx > stepIdx;
              const isCurrent =
                currentIdx === stepIdx &&
                status?.step !== "Completed" &&
                status?.step !== "Done" &&
                status?.step !== "Failed";
              const isFailedStep = currentIdx === stepIdx && status?.step === "Failed";

              return (
                <div
                  key={s.key}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
                    isCurrent
                      ? "bg-[rgba(0,240,255,0.05)] border-[rgba(0,240,255,0.3)] shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                      : isPast || status?.step === "Completed" || status?.step === "Done"
                        ? "bg-[rgba(26,255,26,0.02)] border-[rgba(26,255,26,0.1)]"
                        : isFailedStep
                          ? "bg-[rgba(255,42,95,0.05)] border-[rgba(255,42,95,0.3)]"
                          : "bg-[rgba(255,255,255,0.02)] border-transparent opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {isPast || status?.step === "Completed" || status?.step === "Done" ? (
                      <div className="w-8 h-8 rounded-full bg-[#1AFF1A]/20 flex items-center justify-center text-[#1AFF1A]">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-8 h-8 rounded-full bg-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF]">
                        <div className="premium-spinner w-4 h-4 !border-2" />
                      </div>
                    ) : isFailedStep ? (
                      <div className="w-8 h-8 rounded-full bg-[#FF2A5F]/20 flex items-center justify-center text-[#FF2A5F]">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 font-display text-sm">
                        {i + 1}
                      </div>
                    )}
                    <div className="flex flex-col text-left">
                      <span
                        className={`font-medium ${
                          isCurrent
                            ? "text-white"
                            : isPast || status?.step === "Completed" || status?.step === "Done"
                              ? "text-gray-300"
                              : isFailedStep
                                ? "text-[#FF2A5F]"
                                : "text-gray-500"
                        }`}
                      >
                        {s.label}
                      </span>
                      {isCurrent && status?.progress != null && (
                        <span className="text-[10px] text-[#00F0FF] uppercase tracking-wider font-semibold animate-pulse">
                          Processing • {status.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                  {isCurrent && (
                    <div className="flex gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex gap-4 w-full max-w-md">
            {(status?.step === "Completed" || status?.step === "Done") && (
              <button
                onClick={() => navigate({ to: `/clips` })}
                className="btn-primary flex-1 !py-4"
              >
                Review Clips
              </button>
            )}
            <button onClick={reset} className="btn-secondary flex-1 !py-4 group">
              {status?.step === "Completed" || status?.step === "Done" || status?.step === "Failed"
                ? "Start Over"
                : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══ Render: Upload form ════════════════════════════════════ */
  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto animate-fade-in-up">
      {/* ── Page header ── */}
      <div className="mb-10 flex flex-col items-center text-center">
        <h1 className="font-display text-[2.5rem] font-bold tracking-tight mb-3">
          Create <span className="text-gradient">Viral Shorts</span>
        </h1>
        <p className="text-gray-400 text-sm max-w-lg">
          Drop a video or paste a YouTube link. Our engine will automatically find the best hooks,
          apply smart face-tracking, and render stunning captions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 max-w-6xl mx-auto w-full px-4">
        <div className="space-y-8">
          



          {/* ── Input section ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="label-section">Media Source</div>
              <div className="segmented-control">
                <button
                  className={`segmented-btn ${inputMode === "url" ? "active" : ""}`}
                  onClick={() => setInputMode("url")}
                >
                  YouTube Link
                </button>
                <button
                  className={`segmented-btn ${inputMode === "file" ? "active" : ""}`}
                  onClick={() => setInputMode("file")}
                >
                  Local File
                </button>
              </div>
            </div>

            {inputMode === "url" ? (
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur" />
                <div className="relative flex items-start bg-[rgba(10,10,15,0.7)] border border-[rgba(255,255,255,0.1)] rounded-xl overflow-hidden p-2">
                  <div className="pl-4 pr-3 mt-3">
                    <LinkIcon className="w-5 h-5 text-[#00F0FF]" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 text-lg py-4 px-2 focus:bg-transparent shadow-none"
                    style={{ boxShadow: "none" }}
                  />
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer transition-all duration-300 ${dragOver ? "scale-[1.02]" : ""}`}
              >
                <div
                  className={`absolute -inset-0.5 bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] rounded-2xl blur transition duration-500 ${dragOver ? "opacity-60" : "opacity-0 group-hover:opacity-20"}`}
                />
                <div
                  className={`relative flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed ${dragOver ? "border-[#00F0FF] bg-[rgba(0,240,255,0.05)]" : "border-[rgba(255,255,255,0.1)] bg-[rgba(20,20,25,0.4)]"} backdrop-blur-md`}
                >
                  <UploadIcon
                    className={`w-10 h-10 mb-4 transition-colors duration-300 ${dragOver || file ? "text-[#00F0FF]" : "text-gray-500"}`}
                  />
                  {file ? (
                    <div className="text-center">
                      <div className="text-white font-medium text-lg mb-1">{file.name}</div>
                      <div className="text-[#00F0FF] text-sm font-semibold tracking-wider">
                        {formatBytes(file.size)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-gray-200 font-medium text-lg mb-1">
                        Drag and drop your video
                      </div>
                      <div className="text-gray-500 text-sm">or click to browse computer</div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── Caption templates ── */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="label-section !mb-0">Captions</div>
                <button
                  type="button"
                  onClick={() => setCaptionsOn(!captionsOn)}
                  className={`w-10 h-5 rounded-full transition-colors relative shadow-inner ${captionsOn ? "bg-[#00F0FF]" : "bg-gray-700"}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${captionsOn ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>
              <div
                className={`text-[10px] text-gray-500 uppercase tracking-widest font-semibold font-display transition-opacity ${captionsOn ? "opacity-100" : "opacity-0"}`}
              >
                SELECT 1
              </div>
            </div>

            <div
              className={`grid grid-cols-2 gap-3 transition-opacity duration-300 ${captionsOn ? "opacity-100" : "opacity-40 pointer-events-none"}`}
            >
              {CAPTION_TEMPLATES.map((t, index) => {
                const isPro = index >= 4;
                const active = templates.includes(t.value) && !isPro;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      if (isPro) {
                        alert("Unlock all caption styles with XenClips Pro!");
                        return;
                      }
                      toggleTemplate(t.value);
                    }}
                    className={`card-interactive relative flex items-start gap-3 p-4 text-left ${active ? "active" : ""} ${isPro ? "opacity-60" : ""}`}
                  >
                    {isPro && (
                      <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/50">
                        <Lock className="w-3 h-3 text-[#8A2BE2]" />
                      </div>
                    )}
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${active ? "bg-gradient-to-br from-[#00F0FF] to-[#8A2BE2] shadow-[0_0_10px_rgba(0,240,255,0.4)] border-none" : "border border-[rgba(255,255,255,0.2)]"}`}
                    >
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <div
                        className={`font-display text-[15px] font-semibold mb-1 flex items-center gap-2 ${active ? "text-white" : "text-gray-300"}`}
                      >
                        {t.label}
                        {isPro && <span className="text-[9px] font-bold tracking-wider text-[#8A2BE2] bg-[#8A2BE2]/10 px-1.5 py-0.5 rounded border border-[#8A2BE2]/20 uppercase">Pro</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 leading-snug pr-4">{t.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!templatesValid && (
              <div className="mt-3 flex items-center gap-2 text-[#FF2A5F] text-xs font-medium">
                <AlertTriangle className="w-4 h-4" />
                You must select at least {MIN_TEMPLATES} templates (currently {templates.length})
              </div>
            )}
          </section>
        </div>

        {/* ── Right Sidebar Options ── */}
        <div className="space-y-6">
          <section className="glass-panel p-5">
            <div className="flex flex-col gap-4">
              <LayoutPicker value={layouts} onChange={setLayouts} singleSelect={true} />
            </div>
          </section>

          <section className="glass-panel p-5">
            <div className="label-section mb-4">AI Vibe & Tone</div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display mb-2 block">
                  Clip Selection Theme
                </label>
                <select
                  value={clipVibe}
                  onChange={(e) => setClipVibe(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-white font-display focus:border-[#00F0FF] focus:outline-none focus:ring-1 focus:ring-[#00F0FF] transition-all"
                >
                  <option value="viral">Viral & Shocking</option>
                  <option value="funny">Funny & Comedic</option>
                  <option value="serious">Serious & Deep</option>
                  <option value="aura farm">Aura Farm / Hype</option>
                  <option value="educational">Educational & Value</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display mb-2 block">
                  Hook Text Style
                </label>
                <select
                  value={hookVibe}
                  onChange={(e) => setHookVibe(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-white font-display focus:border-[#00F0FF] focus:outline-none focus:ring-1 focus:ring-[#00F0FF] transition-all"
                >
                  <option value="clickbait">Clickbait & Shocking</option>
                  <option value="funny">Funny & Meme</option>
                  <option value="serious">Serious & Direct</option>
                  <option value="mysterious">Curiosity & Mystery</option>
                  <option value="bold">Bold & Aggressive</option>
                </select>
              </div>

              {/* Hook Text Language */}
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display mb-2 block">
                  Hook Text Language
                </label>
                <div className="flex gap-2">
                  {(["auto", "english", "hinglish"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setHookLang(lang)}
                      className={`flex-1 py-2 rounded-lg font-display text-xs font-semibold tracking-wider uppercase transition-all duration-300 border ${hookLang === lang ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF] text-[#00F0FF] shadow-[inset_0_0_10px_rgba(0,240,255,0.08)]" : "bg-transparent border-[rgba(255,255,255,0.05)] text-gray-400 hover:border-[rgba(255,255,255,0.2)] hover:text-white"}`}
                    >
                      {lang === "auto" ? "🌐 Auto" : lang === "english" ? "🇬🇧 EN" : "🇮🇳 HI"}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Auto detects transcript language</p>
              </div>

              {/* Creator Name in Hook */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <Switch
                    checked={creatorNameEnabled}
                    onCheckedChange={setCreatorNameEnabled}
                    className="data-[state=checked]:!bg-[#00F0FF]"
                  />
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                    Include Creator Name
                  </span>
                </label>
                {creatorNameEnabled && (
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="e.g. MrBeast, Ranveer Allahbadia..."
                    className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-white font-display placeholder-gray-600 focus:border-[#00F0FF] focus:outline-none focus:ring-1 focus:ring-[#00F0FF] transition-all"
                  />
                )}
              </div>
            </div>
          </section>

          <section className="glass-panel p-5">
            <div className="label-section mb-4">Placement</div>
            <div className="flex flex-col gap-2">
              {(["top", "center", "bottom"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosition(pos)}
                  className={`w-full py-2.5 rounded-lg font-display text-sm font-semibold tracking-wider uppercase transition-all duration-300 border ${position === pos ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF] text-[#00F0FF] shadow-[inset_0_0_15px_rgba(0,240,255,0.1)]" : "bg-transparent border-[rgba(255,255,255,0.05)] text-gray-400 hover:border-[rgba(255,255,255,0.2)] hover:text-white"}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </section>

          <section className="glass-panel p-5">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between"
            >
              <span className="label-section !mb-0">Advanced Tuning</span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${advancedOpen ? "rotate-180" : ""}`}
              />
            </button>

            {advancedOpen && (
              <div className="mt-6 space-y-6 animate-fade-in-up">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                      Target Clip Count
                    </span>
                    <span className="text-[#00F0FF] font-bold font-mono text-sm">
                      {numClips} Clips
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={Number.isNaN(numClips) ? 1 : numClips}
                    onChange={(e) => setNumClips(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 (Fastest)</span>
                    <span>7 (Max)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={maxWordsOn}
                        onCheckedChange={setMaxWordsOn}
                        className="data-[state=checked]:!bg-[#00F0FF]"
                      />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                        Words / Line
                      </span>
                    </label>
                    {maxWordsOn && (
                      <span className="text-[#00F0FF] font-bold font-mono text-sm">{maxWords}</span>
                    )}
                  </div>
                  {maxWordsOn && (
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={maxWords}
                      onChange={(e) => setMaxWords(Number(e.target.value))}
                    />
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={fontSizeOn}
                        onCheckedChange={setFontSizeOn}
                        className="data-[state=checked]:!bg-[#00F0FF]"
                      />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                        Font Scale
                      </span>
                    </label>
                    {fontSizeOn && (
                      <span className="text-[#00F0FF] font-bold font-mono text-sm">
                        {fontSize}px
                      </span>
                    )}
                  </div>
                  {fontSizeOn && (
                    <input
                      type="range"
                      min={20}
                      max={150}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                  )}
                </div>



                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={fadeEnabled}
                        onCheckedChange={setFadeEnabled}
                        className="data-[state=checked]:!bg-[#00F0FF]"
                      />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                        Video Fades
                      </span>
                    </label>
                  </div>
                  <p className="text-[12px] text-gray-400">
                    Apply a subtle fade-in and fade-out to the video.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-widest font-display">
                      Hook Style
                    </span>
                  </div>
                  <select
                    value={hookStyle}
                    onChange={(e) => setHookStyle(e.target.value)}
                    className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded px-3 py-2 text-sm text-white font-display focus:border-[#00F0FF] focus:outline-none focus:ring-1 focus:ring-[#00F0FF] transition-all"
                  >
                    <option value="default">Default</option>
                    <option value="mrbeast">MrBeast</option>
                    <option value="neon_blue">Neon Blue</option>
                    <option value="fire">Fire</option>
                    <option value="toxic_green">Toxic Green</option>
                    <option value="hot_pink">Hot Pink</option>
                    <option value="purple_glow">Purple Glow</option>
                    <option value="ice_white">Ice White</option>
                    <option value="orange_pop">Orange Pop</option>
                    <option value="yellow_stroke">Yellow Stroke</option>
                    <option value="gold_luxury">Gold Luxury</option>
                    <option value="white_box">White Box</option>
                    <option value="dark_glass">Dark Glass</option>
                    <option value="red_alert">Red Alert</option>
                    <option value="cyan_glow">Cyan Glow</option>
                  </select>
                </div>

                {/* Real-time Preview Box */}
                <MockPreview
                  fontSize={fontSizeOn ? fontSize : 48}
                  maxWords={maxWordsOn ? maxWords : 4}
                  position={position}
                  template={templates.length > 0 ? templates[0] : "alex_hormozi"}
                  layout={layouts.length > 0 ? layouts[0] : "full_vertical"}
                  hookStyle={hookStyle}
                />
              </div>
            )}
          </section>

          <section className="glass-panel p-5">
            <button
              type="button"
              onClick={() => setSmartEnhancementsOpen(!smartEnhancementsOpen)}
              className="w-full flex items-center justify-between"
            >
              <span className="label-section !mb-0 text-[#8A2BE2]">Smart Enhancements</span>
              <ChevronDown
                className={`w-4 h-4 text-[#8A2BE2] transition-transform duration-300 ${smartEnhancementsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {smartEnhancementsOpen && (
              <div className="mt-6 space-y-6 animate-fade-in-up">
                {/* Smart Zoom */}
                <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="flex justify-between items-center mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={smartZoomEnabled}
                        onCheckedChange={setSmartZoomEnabled}
                        className="data-[state=checked]:!bg-[#8A2BE2]"
                      />
                      <span className="text-sm font-semibold text-white tracking-wide font-display">
                        Smart Zooms
                      </span>
                    </label>
                  </div>
                  {smartZoomEnabled && (
                    <div className="space-y-4 animate-fade-in-up">
                      <div>
                        <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          Style
                        </div>
                        <select
                          value={smartZoomStyle}
                          onChange={(e) => setSmartZoomStyle(e.target.value as any)}
                          className="w-full text-sm"
                        >
                          <option value="dynamic">Dynamic (Auto-detect)</option>
                          <option value="smooth">Smooth (102-108% slow)</option>
                          <option value="punch">Punch (105-115% sudden)</option>
                          <option value="cinematic">Cinematic (Slow pan)</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          Intensity
                        </div>
                        <div className="segmented-control">
                          <button
                            className={`segmented-btn ${smartZoomIntensity === "low" ? "active" : ""}`}
                            onClick={() => setSmartZoomIntensity("low")}
                          >
                            Low
                          </button>
                          <button
                            className={`segmented-btn ${smartZoomIntensity === "medium" ? "active" : ""}`}
                            onClick={() => setSmartZoomIntensity("medium")}
                          >
                            Medium
                          </button>
                          <button
                            className={`segmented-btn ${smartZoomIntensity === "high" ? "active" : ""}`}
                            onClick={() => setSmartZoomIntensity("high")}
                          >
                            High
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Speed Ramps */}
                <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="flex justify-between items-center mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={speedRampEnabled}
                        onCheckedChange={setSpeedRampEnabled}
                        className="data-[state=checked]:!bg-[#8A2BE2]"
                      />
                      <span className="text-sm font-semibold text-white tracking-wide font-display">
                        Smart Speed Ramps
                      </span>
                    </label>
                  </div>
                  {speedRampEnabled && (
                    <div className="animate-fade-in-up">
                      <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                        Maximum Speed
                      </div>
                      <select
                        value={speedRampMax}
                        onChange={(e) => setSpeedRampMax(Number(e.target.value))}
                        className="w-full text-sm"
                      >
                        <option value={1.15}>1.15x (Subtle)</option>
                        <option value={1.2}>1.20x (Balanced)</option>
                        <option value={1.25}>1.25x (Fast)</option>
                        <option value={1.3}>1.30x (Aggressive)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="glass-panel p-5">
            <button
              type="button"
              onClick={() => setWatermarksOpen(!watermarksOpen)}
              className="w-full flex items-center justify-between"
            >
              <span className="label-section !mb-0 text-[#00F0FF]">Watermarks</span>
              <ChevronDown
                className={`w-4 h-4 text-[#00F0FF] transition-transform duration-300 ${watermarksOpen ? "rotate-180" : ""}`}
              />
            </button>

            {watermarksOpen && (
              <div className="mt-6 space-y-6 animate-fade-in-up">
                <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <div className="flex justify-between items-center mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch
                        checked={watermarkEnabled}
                        onCheckedChange={setWatermarkEnabled}
                        className="data-[state=checked]:!bg-[#00F0FF]"
                      />
                      <span className="text-sm font-semibold text-white tracking-wide font-display">
                        Enable Watermark
                      </span>
                    </label>
                  </div>

                  {watermarkEnabled && (
                    <div className="space-y-4 animate-fade-in-up">
                      <div>
                        <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          Type
                        </div>
                        <select
                          value={watermarkType}
                          onChange={(e) => setWatermarkType(e.target.value as any)}
                          className="w-full text-sm"
                        >
                          <option value="png">PNG Logo</option>
                          <option value="svg">SVG Logo</option>
                          <option value="text">Text Only</option>
                          <option value="logo_text">Logo + Text</option>
                        </select>
                      </div>

                      {(watermarkType === "png" ||
                        watermarkType === "svg" ||
                        watermarkType === "logo_text") && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                            Logo File
                          </div>
                          <input
                            type="file"
                            accept={watermarkType === "svg" ? ".svg" : ".png"}
                            onChange={(e) => setWatermarkFile(e.target.files?.[0] || null)}
                            className="w-full text-sm bg-black/20 p-2 rounded border border-white/10"
                          />
                        </div>
                      )}

                      {(watermarkType === "text" || watermarkType === "logo_text") && (
                        <div>
                          <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                            Text
                          </div>
                          <input
                            type="text"
                            value={watermarkText}
                            onChange={(e) => setWatermarkText(e.target.value)}
                            className="w-full text-sm bg-black/20 p-2 rounded border border-white/10 text-white"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                            Position
                          </div>
                          <select
                            value={watermarkPosition}
                            onChange={(e) => setWatermarkPosition(e.target.value as any)}
                            className="w-full text-sm"
                          >
                            <option value="top_left">Top Left</option>
                            <option value="top_right">Top Right</option>
                            <option value="bottom_left">Bottom Left</option>
                            <option value="bottom_right">Bottom Right</option>
                            <option value="center">Center</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                            Animation
                          </div>
                          <select
                            value={watermarkAnimation}
                            onChange={(e) => setWatermarkAnimation(e.target.value as any)}
                            className="w-full text-sm"
                          >
                            <option value="none">Static (None)</option>
                            <option value="fade_in">Fade In</option>
                            <option value="fade_out">Fade Out</option>
                            <option value="slide_in">Slide In</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          <span>Opacity</span>
                          <span className="text-[#00F0FF]">{watermarkOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          <span>Scale</span>
                          <span className="text-[#00F0FF]">{watermarkScale}%</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={watermarkScale}
                          onChange={(e) => setWatermarkScale(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">
                          <span>Margin</span>
                          <span className="text-[#00F0FF]">{watermarkMargin}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          value={watermarkMargin}
                          onChange={(e) => setWatermarkMargin(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="mt-12 p-6 glass-panel flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Decorative background glow for action bar */}
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-gradient-to-tl from-[#8A2BE2] to-transparent opacity-20 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] flex items-center justify-center">
            <Film className="w-5 h-5 text-[#00F0FF]" />
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-display font-semibold mb-1">
              Estimated Output
            </div>
            <div className="text-white font-medium">
              ~{estClips} clips × {layouts.length} lay.{" "}
              {captionsOn ? `× ${templates.length} temp.` : ""} ={" "}
              <span className="text-[#00F0FF] font-bold text-lg ml-1">{estTotal} Videos</span>
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary w-full sm:w-auto min-w-[200px] !py-4 !text-base"
        >
          {submitting ? (
            <>
              <div className="premium-spinner w-4 h-4 !border-2" />
              Initializing...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Synthesize Engine
            </>
          )}
        </button>
      </div>

      <AlertDialog open={showInterruptDialog} onOpenChange={setShowInterruptDialog}>
        <AlertDialogContent className="bg-[#0f0f13] border-[#2a2a35] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#00F0FF]">Processing in Progress</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              You pressed{" "}
              <kbd className="bg-gray-800 px-1 rounded">
                Ctrl+{shortcuts.interruptProcessing.toUpperCase()}
              </kbd>
              , which might navigate away from this page and interrupt your local processing job.
              Please wait for the current job to finish before leaving the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowInterruptDialog(false)}
              className="bg-[#00F0FF] text-black hover:bg-[#00d0dd]"
            >
              Continue Processing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MockPreview({
  fontSize,
  maxWords,
  position,
  template,
  layout,
  hookStyle,
}: {
  fontSize: number;
  maxWords: number;
  position: string;
  template: string;
  layout: string;
  hookStyle?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const dummyWords = ["THIS", "IS", "A", "VIRAL", "HOOK", "FOR", "SHORTS"];
  const chunk = dummyWords.slice(0, maxWords);

  useEffect(() => {
    const int = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % chunk.length);
    }, 600);
    return () => clearInterval(int);
  }, [chunk.length]);

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
    }[template as string] || "#FFFF00";

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
    }[template as string] || "Arial, sans-serif";

  // Helper for text shadow based on template
  const getTextShadow = (isActive: boolean) => {
    if (
      template === "minimal_clean" ||
      template === "typewriter" ||
      template === "blueprint" ||
      template === "old_newspaper"
    )
      return "none";
    if (template === "mrbeast")
      return "0px 0px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 6px 0px rgba(0,0,0,1)";
    if (template === "comic_book")
      return "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 4px 4px 0 #000";
    if (template === "comic_manga")
      return "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000";
    if (template === "street_graffiti")
      return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 5px rgba(255,0,85,0.8)";
    if (template === "luxury_marble") return "1px 1px 2px rgba(0,0,0,0.5)";
    if (template === "liquid_glass") return "0 2px 10px rgba(255,255,255,0.5)";
    if (template === "holographic") return "0 0 5px #00FFFF, 0 0 10px #FF00FF, 0 0 20px #FF00FF";
    if (template === "blueprint_hud") return "0 0 5px #00FFFF, 0 0 10px #00FFFF";
    if (template === "gaming")
      return isActive ? "0 0 10px #FF00FF, 0 0 20px #FF00FF" : "0 0 10px #00FFFF";
    if (template === "cyberpunk")
      return isActive ? "2px 2px 0px #FF0000, -2px -2px 0px #00FFFF" : "none";
    if (template === "podcast" || template === "hacker" || template === "news_flash") return "none";
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
    if (template === "iman_gadzhi") {
      if (text.length >= 4) return activeColor;
      return "#FFFFFF";
    }
    if (template === "minimal_clean" || template === "typewriter" || template === "comic_manga")
      return "#FFFFFF";
    if (template === "old_newspaper") return "#000000";
    return activeColor;
  };

  const isWide = layout === "original";

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: position === "top" ? "15%" : position === "center" ? "50%" : "auto",
    bottom: position === "bottom" ? "15%" : "auto",
    transform: position === "center" ? "translate(-50%, -50%)" : "translateX(-50%)",
    textAlign: "center",
    fontFamily: fontFam,
    fontSize: `${fontSize * 0.4}px`,
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
    containerStyle.backgroundImage =
      "linear-gradient(#1565c0 1px, transparent 1px), linear-gradient(90deg, #1565c0 1px, transparent 1px)";
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

  return (
    <div
      className={`relative w-full ${isWide ? "aspect-[16/9]" : "aspect-[9/16]"} bg-[#050508] rounded-xl border border-[rgba(255,255,255,0.05)] overflow-hidden flex flex-col items-center mt-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-all duration-500`}
    >
      {/* Fake Video Subject based on Layout */}
      {layout === "bw_letterbox" && (
        <div className="absolute inset-x-0 top-1/4 bottom-1/4 bg-white/10 flex items-center justify-center border-y border-white/5">
          <div className="w-16 h-24 bg-white/20 rounded-[100%] blur-xl" />
        </div>
      )}
      {layout === "blur_bg" && (
        <>
          <div className="absolute inset-0 bg-white/5 backdrop-blur-xl" />
          <div className="absolute inset-x-0 top-1/4 bottom-1/4 bg-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center">
            <div className="w-16 h-24 bg-white/20 rounded-[100%] blur-xl" />
          </div>
        </>
      )}
      {(layout === "full_vertical" || layout === "original") && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-24 h-48 bg-white rounded-[100%] blur-3xl" />
        </div>
      )}

      {/* Hook Text Preview */}
      {hookStyle && (
        <div
          className="absolute top-[10%] left-1/2 -translate-x-1/2 text-center whitespace-nowrap z-40 transition-all duration-300"
          style={{
            fontFamily: "Impact, sans-serif",
            fontSize: `${Math.max(16, fontSize * 0.4)}px`,
            fontWeight: "900",
            textTransform: "uppercase",
            ...(hookStyle === "default"
              ? {
                  color: "#FFFFFF",
                  textShadow:
                    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 4px 6px rgba(0,0,0,0.8)",
                }
              : {}),
            ...(hookStyle === "mrbeast"
              ? {
                  color: "#FFFFFF",
                  textShadow:
                    "0px 0px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 0px rgba(0,0,0,1)",
                }
              : {}),
            ...(hookStyle === "neon_blue"
              ? {
                  color: "#FFFFFF",
                  textShadow: "0 0 10px #00F0FF, 0 0 20px #00F0FF, 0 0 30px #00F0FF",
                }
              : {}),
            ...(hookStyle === "fire"
              ? { color: "#FF3300", textShadow: "0 2px 4px #000, 0 -2px 10px #FF9900" }
              : {}),
            ...(hookStyle === "toxic_green"
              ? { color: "#39FF14", textShadow: "2px 2px 0 #000, 0 0 15px #39FF14" }
              : {}),
            ...(hookStyle === "hot_pink"
              ? { color: "#FF1493", textShadow: "2px 2px 0 #000, 0 0 10px #FF69B4" }
              : {}),
            ...(hookStyle === "purple_glow"
              ? { color: "#9D00FF", textShadow: "0 0 15px #9D00FF" }
              : {}),
            ...(hookStyle === "ice_white"
              ? { color: "#FFFFFF", textShadow: "0 0 10px #AEEFFF, 2px 2px 4px #000" }
              : {}),
            ...(hookStyle === "orange_pop"
              ? {
                  color: "#FFA500",
                  textShadow:
                    "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 4px 4px 0 #000",
                }
              : {}),
            ...(hookStyle === "yellow_stroke"
              ? {
                  color: "#FFFF00",
                  textShadow:
                    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 4px 6px rgba(0,0,0,0.8)",
                }
              : {}),
            ...(hookStyle === "gold_luxury"
              ? { color: "#FFD700", textShadow: "0 2px 10px rgba(255,215,0,0.5), 2px 2px 2px #000" }
              : {}),
            ...(hookStyle === "white_box"
              ? {
                  color: "#000000",
                  background: "#FFFFFF",
                  padding: "4px 12px",
                  borderRadius: "4px",
                }
              : {}),
            ...(hookStyle === "dark_glass"
              ? {
                  color: "#FFFFFF",
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(4px)",
                  padding: "4px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                }
              : {}),
            ...(hookStyle === "red_alert"
              ? {
                  color: "#FF0000",
                  textShadow: "2px 2px 0 #000, 0 0 15px #FF0000",
                  borderBottom: "4px solid #FF0000",
                }
              : {}),
            ...(hookStyle === "cyan_glow"
              ? {
                  color: "#00FFFF",
                  textShadow: "0 0 5px #00FFFF, 0 0 10px #00FFFF, 2px 2px 0 #000",
                }
              : {}),
          }}
        >
          WAIT FOR IT 🤯
        </div>
      )}

      <div style={containerStyle} className="caption-preview-container">
        {chunk.map((w, i) => {
          const isActive = i === activeIdx;
          return (
            <span
              key={i}
              className={`inline-block mx-[4px] transition-colors duration-100 ${getAnimationClass(isActive)}`}
              style={{
                color: getTextColor(isActive, w),
                textShadow: getTextShadow(isActive),
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div className="absolute bottom-2 right-3 text-[9px] text-gray-500 font-display uppercase tracking-widest font-semibold">
        Live Preview
      </div>
    </div>
  );
}
