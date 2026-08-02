const DEFAULT_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

export function getApiBase(): string {
  if (typeof window === "undefined") return DEFAULT_BASE;
  return localStorage.getItem("clipper.apiBase") || DEFAULT_BASE;
}

export function setApiBase(url: string) {
  localStorage.setItem("clipper.apiBase", url);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export type ProcessingStep =
  | "downloading"
  | "transcribing"
  | "transcript"
  | "finding_viral"
  | "cutting_raw"
  | "transcribing_whisper"
  | "correcting_hinglish"
  | "detecting"
  | "subtitles"
  | "cutting"
  | "rendering"
  | "done"
  | "error";

export interface JobStatus {
  job_id: string;
  step: ProcessingStep | string;
  progress?: number; // 0-100 for current step
  error?: string;
  clip_ids?: string[];
  layouts?: LayoutTemplate[];
  templates?: CaptionTemplate[];
}

export interface Clip {
  clip_id: string;
  job_id: string;
  clip_number?: number;
  thumbnail_url?: string;
  video_path?: string;
  duration: number; // seconds
  hook_text: string;
  hook_style?: string;
  emoji: string;
  reaction_moment?: boolean;
  layout?: LayoutTemplate;
  template?: CaptionTemplate;
  position?: CaptionPosition;
  max_words?: number;
  font_size?: number;
  failed?: boolean;
  category?: string;
  segment_type?: string;
  emotional_intensity?: number;
  emotion_peaks?: { time: number; intensity: number }[];
  sfx_cues?: { time_offset: number; type: string }[];
}

export type LayoutTemplate =
  "full_vertical" | "bw_letterbox" | "blur_bg" | "streamer" | "original" | "vertical_no_tracking";

export type CaptionTemplate =
  | "alex_hormozi"
  | "mrbeast"
  | "iman_gadzhi"
  | "ali_abdaal"
  | "podcast"
  | "gaming"
  | "motivational"
  | "minimal_clean"
  | "tiktok_viral"
  | "premium_cinematic"
  | "cyberpunk"
  | "hacker"
  | "dreamy"
  | "news_flash"
  | "y2k_bubbly"
  | "comic_book"
  | "typewriter"
  | "liquid_glass"
  | "blueprint"
  | "street_graffiti"
  | "luxury_marble"
  | "comic_manga"
  | "holographic"
  | "old_newspaper"
  | "blueprint_hud";
export type CaptionPosition = "bottom" | "center" | "top";

export interface ClipSettings {
  template: CaptionTemplate;
  position: CaptionPosition;
  layout: LayoutTemplate;
  hook_text_enabled: boolean;
  hook_text: string;
  hook_style: string;
  fade_in: number;
  fade_out: number;
  zoom_punch: boolean;
  face_tracking: boolean;
}

export const DEFAULT_CLIP_SETTINGS: ClipSettings = {
  template: "alex_hormozi",
  position: "bottom",
  layout: "full_vertical",
  hook_text_enabled: true,
  hook_text: "",
  hook_style: "default",
  fade_in: 0.3,
  fade_out: 0.3,
  zoom_punch: false,
  face_tracking: false,
};

// ----- Per-clip override persistence (frontend-only for now) -----
const OVERRIDES_KEY = "clipper.clipOverrides";
const BULK_KEY = "clipper.bulkSettings";

type OverrideMap = Record<string, ClipSettings>;

function readOverrides(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeOverrides(m: OverrideMap) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(m));
}
export function getClipOverride(clipId: string): ClipSettings | null {
  return readOverrides()[clipId] ?? null;
}
export function setClipOverride(clipId: string, s: ClipSettings) {
  const m = readOverrides();
  m[clipId] = s;
  writeOverrides(m);
}
export function clearClipOverride(clipId: string) {
  const m = readOverrides();
  delete m[clipId];
  writeOverrides(m);
}
export function getAllOverrides(): OverrideMap {
  return readOverrides();
}

export function getBulkSettings(): ClipSettings {
  if (typeof window === "undefined") return DEFAULT_CLIP_SETTINGS;
  try {
    return { ...DEFAULT_CLIP_SETTINGS, ...JSON.parse(localStorage.getItem(BULK_KEY) || "{}") };
  } catch {
    return DEFAULT_CLIP_SETTINGS;
  }
}
export function saveBulkSettings(s: ClipSettings) {
  localStorage.setItem(BULK_KEY, JSON.stringify(s));
}

export interface Settings {
  encoder: "auto" | "qsv" | "cpu";
  whisper_model: "small" | "medium";
  default_layout: LayoutTemplate;
}

export interface GeminiKeyStatus {
  key: string;
  used_today: number;
}

export interface GeminiSettings {
  keys: Array<{ key: string; used_today: number }>;
  limit_per_key: number;
  model: string;
}

export interface AppSettings {
  whatsapp_enabled: boolean;
  whatsapp_number: string;
}

export interface Preset {
  preset_id: string;
  data: Record<string, any>;
}

export const api = {
  process: (body: {
    url?: string;
    layouts: LayoutTemplate[];
    templates: CaptionTemplate[];
    position: CaptionPosition;
    max_words?: number;
    font_size?: number;
    target_duration?: number;
    num_clips?: number;
    sfx_enabled?: boolean;
    sfx_volume?: number;
    sfx_pack?: string;
    smart_zoom_enabled?: boolean;
    smart_zoom_style?: "smooth" | "punch" | "cinematic" | "dynamic";
    smart_zoom_intensity?: "low" | "medium" | "high";
    speed_ramp_enabled?: boolean;
    speed_ramp_max?: number;
    watermark_enabled?: boolean;
    watermark_type?: "png" | "svg" | "text" | "logo_text";
    watermark_text?: string;
    watermark_position?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";
    watermark_opacity?: number;
    watermark_scale?: number;
    watermark_margin?: number;
    watermark_animation?: "none" | "fade_in" | "fade_out" | "slide_in";
  }) =>
    request<{ job_id: string }>("/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  processFile: (
    file: File,
    opts: {
      layouts: LayoutTemplate[];
      templates: CaptionTemplate[];
      position: CaptionPosition;
      max_words?: number;
      font_size?: number;
      target_duration?: number;
      num_clips?: number;
      sfx_enabled?: boolean;
      sfx_volume?: number;
      sfx_pack?: string;
      generate_captions?: boolean;
      hook_style?: string;
      clip_vibe?: string;
      hook_vibe?: string;
      fade_enabled?: boolean;
      smart_zoom_enabled?: boolean;
      smart_zoom_style?: "smooth" | "punch" | "cinematic" | "dynamic";
      smart_zoom_intensity?: "low" | "medium" | "high";
      speed_ramp_enabled?: boolean;
      speed_ramp_max?: number;
      watermark_enabled?: boolean;
      watermark_type?: "png" | "svg" | "text" | "logo_text";
      watermark_text?: string;
      watermark_position?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";
      watermark_opacity?: number;
      watermark_scale?: number;
      watermark_margin?: number;
      watermark_animation?: "none" | "fade_in" | "fade_out" | "slide_in";
      watermark_file?: File;
    },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    for (const l of opts.layouts) fd.append("layouts", l);
    for (const t of opts.templates) fd.append("templates", t);
    fd.append("position", opts.position);
    if (opts.max_words != null) fd.append("max_words", String(opts.max_words));
    if (opts.font_size != null) fd.append("font_size", String(opts.font_size));
    if (opts.target_duration != null) fd.append("target_duration", String(opts.target_duration));
    if (opts.num_clips != null) fd.append("num_clips", String(opts.num_clips));
    if (opts.sfx_enabled != null) fd.append("sfx_enabled", String(opts.sfx_enabled));
    if (opts.sfx_volume != null) fd.append("sfx_volume", String(opts.sfx_volume));
    if (opts.sfx_pack != null) fd.append("sfx_pack", opts.sfx_pack);
    if (opts.generate_captions != null)
      fd.append("generate_captions", String(opts.generate_captions));
    if (opts.hook_style != null) fd.append("hook_style", opts.hook_style);
    if (opts.clip_vibe != null) fd.append("clip_vibe", opts.clip_vibe);
    if (opts.hook_vibe != null) fd.append("hook_vibe", opts.hook_vibe);
    if (opts.fade_enabled != null) fd.append("fade_enabled", String(opts.fade_enabled));
    if (opts.smart_zoom_enabled != null)
      fd.append("smart_zoom_enabled", String(opts.smart_zoom_enabled));
    if (opts.smart_zoom_style != null) fd.append("smart_zoom_style", opts.smart_zoom_style);
    if (opts.smart_zoom_intensity != null)
      fd.append("smart_zoom_intensity", opts.smart_zoom_intensity);
    if (opts.speed_ramp_enabled != null)
      fd.append("speed_ramp_enabled", String(opts.speed_ramp_enabled));
    if (opts.speed_ramp_max != null) fd.append("speed_ramp_max", String(opts.speed_ramp_max));
    if (opts.watermark_enabled != null)
      fd.append("watermark_enabled", String(opts.watermark_enabled));
    if (opts.watermark_type != null) fd.append("watermark_type", opts.watermark_type);
    if (opts.watermark_text != null) fd.append("watermark_text", opts.watermark_text);
    if (opts.watermark_position != null) fd.append("watermark_position", opts.watermark_position);
    if (opts.watermark_opacity != null)
      fd.append("watermark_opacity", String(opts.watermark_opacity));
    if (opts.watermark_scale != null) fd.append("watermark_scale", String(opts.watermark_scale));
    if (opts.watermark_margin != null) fd.append("watermark_margin", String(opts.watermark_margin));
    if (opts.watermark_animation != null)
      fd.append("watermark_animation", opts.watermark_animation);
    if (opts.watermark_file != null) fd.append("watermark_file", opts.watermark_file);
    return request<{ job_id: string }>("/process", { method: "POST", body: fd });
  },

  status: (jobId: string) => request<JobStatus>(`/status/${jobId}`),
  clips: (jobId: string) => request<Clip[]>(`/clips/${jobId}`),
  updateClip: (clipId: string, patch: Partial<Clip>) =>
    request<Clip>(`/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  exportClip: (clipId: string) =>
    request<{ status: string; video_path?: string }>(`/clips/${clipId}/export`, {
      method: "POST",
    }),
  getCaptions: (clipId: string) =>
    request<Array<{ text: string; start: number; end: number }>>(`/clips/${clipId}/captions`),
  updateCaptions: (clipId: string, words: Array<{ text: string; start: number; end: number }>) =>
    request<{ status: string; regenerated_templates_count: number }>(`/clips/${clipId}/captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    }),
  cleanupJob: (jobId: string) =>
    request<{ status: string }>(`/jobs/${jobId}/cleanup`, { method: "POST" }),
  getGeminiSettings: () => request<GeminiSettings>("/gemini-settings"),
  updateGeminiSettings: (keys: string[], limit_per_key: number, model: string) =>
    request<{ status: string }>("/gemini-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, limit_per_key, model }),
    }),
  getAppSettings: () => request<AppSettings>("/app-settings"),
  updateAppSettings: (whatsapp_enabled: boolean, whatsapp_number: string) =>
    request<{ status: string }>("/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_enabled, whatsapp_number }),
    }),
  getWhatsappStatus: () => request<{ connected: boolean; error?: string }>("/whatsapp/status"),
  getWhatsappQr: () =>
    request<{ connected: boolean; qr: string | null; error?: string; message?: string }>(
      "/whatsapp/qr",
    ),
  testWhatsapp: () => request<{ status: string }>("/whatsapp/test", { method: "POST" }),
  jobs: () => request<any[]>("/jobs"),
  cancelJob: (jobId: string) =>
    request<{ status: string }>(`/jobs/${jobId}/cancel`, { method: "POST" }),
  removeJob: (jobId: string) => request<{ status: string }>(`/jobs/${jobId}`, { method: "DELETE" }),
  shutdown: () => request<{ status: string }>("/shutdown", { method: "POST" }),
  getPresets: () => request<Record<string, Record<string, any>>>("/presets"),
  savePreset: (preset_id: string, data: Record<string, any>) =>
    request<{ status: string }>("/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset_id, data }),
    }),
  deletePreset: (preset_id: string) =>
    request<{ status: string }>(`/presets/${preset_id}`, { method: "DELETE" }),
};

// Local settings (persisted client-side; backend can also expose /settings later)
const SETTINGS_KEY = "clipper.settings";
export const DEFAULT_SETTINGS: Settings = {
  encoder: "auto",
  whisper_model: "small",
  default_layout: "full_vertical",
};
export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Track most recent job for quick access to /clips
export function setCurrentJob(jobId: string) {
  localStorage.setItem("clipper.currentJob", jobId);
}
export function getCurrentJob(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("clipper.currentJob");
}
