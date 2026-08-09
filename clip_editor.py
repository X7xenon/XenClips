import os
import json
import subprocess
import re
import shutil
import tempfile
import uuid



# ==========================
# Fontconfig bootstrap (Windows)
# ==========================
def _ensure_fontconfig():
    """Create a minimal fonts.conf so libass / drawtext can find system fonts
    on Windows where fontconfig ships no default config."""
    if os.environ.get("FONTCONFIG_FILE"):
        return  # already configured
    fc_dir = os.path.join(tempfile.gettempdir(), "shorts_fontconfig")
    os.makedirs(fc_dir, exist_ok=True)
    fc_path = os.path.join(fc_dir, "fonts.conf")
    if not os.path.exists(fc_path):
        win_fonts = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
        fc_xml = f"""<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>{win_fonts}</dir>
  <cachedir>{fc_dir}/cache</cachedir>
  <match target="pattern">
    <edit name="family" mode="append_last">
      <string>Arial</string>
    </edit>
  </match>
</fontconfig>
"""
        with open(fc_path, "w", encoding="utf-8") as f:
            f.write(fc_xml)
    os.environ["FONTCONFIG_FILE"] = fc_path
    os.environ["FONTCONFIG_PATH"] = fc_dir


_ensure_fontconfig()


# ==========================
# Load clips.json
# ==========================
def load_clips(clips_path):
    with open(clips_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ==========================
# Probe video metadata
# ==========================
def probe_video(video_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,duration",
        "-of", "json", video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    stream = data["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    num, den = stream["r_frame_rate"].split("/")
    fps = round(float(num) / float(den), 2)
    return width, height, fps


# ==========================
# Layout templates (9:16 output, 3 styles)
# ==========================
# LAYOUT values:
#   "full_vertical" — content-aware/center crop, fills the whole 1080x1920 frame
#   "bw_letterbox"  — original aspect kept, centered, black bars top/bottom
#   "blur_bg"       — original aspect kept, centered, blurred stretched copy fills bars
LAYOUTS = ["bw_letterbox", "blur_bg", "streamer", "original"]


# ==========================
# Hook Text Styles
# ==========================
# Each style defines ffmpeg drawtext parameters for the hook overlay.
# Keys: fontcolor, bordercolor, borderw, box (0|1), boxcolor, boxborderw,
#        shadowcolor, shadowx, shadowy, extra (raw extra filter options str)
HOOK_STYLES = {
    "default": {
        "fontcolor": "white",
        "borderw": 3,
        "bordercolor": "black",
        "box": 0,
        "shadowx": 0, "shadowy": 0,
    },
    "neon_blue": {
        "fontcolor": "#00F0FF",
        "borderw": 4,
        "bordercolor": "#001030",
        "box": 0,
        "shadowx": 2, "shadowy": 2,
        "shadowcolor": "#0066FF",
    },
    "fire": {
        "fontcolor": "#FFD700",
        "borderw": 4,
        "bordercolor": "#8B0000",
        "box": 0,
        "shadowx": 3, "shadowy": 3,
        "shadowcolor": "#FF4500",
    },
    "toxic_green": {
        "fontcolor": "#39FF14",
        "borderw": 4,
        "bordercolor": "#003300",
        "box": 0,
        "shadowx": 2, "shadowy": 2,
        "shadowcolor": "#00CC00",
    },
    "hot_pink": {
        "fontcolor": "#FF69B4",
        "borderw": 4,
        "bordercolor": "#4B0030",
        "box": 0,
        "shadowx": 2, "shadowy": 2,
        "shadowcolor": "#CC0066",
    },
    "gold_luxury": {
        "fontcolor": "#FFD700",
        "borderw": 0,
        "bordercolor": "black",
        "box": 1,
        "boxcolor": "black@0.65",
        "boxborderw": 12,
        "shadowx": 0, "shadowy": 0,
    },
    "white_box": {
        "fontcolor": "black",
        "borderw": 0,
        "bordercolor": "black",
        "box": 1,
        "boxcolor": "white@0.9",
        "boxborderw": 14,
        "shadowx": 0, "shadowy": 0,
    },
    "red_alert": {
        "fontcolor": "white",
        "borderw": 3,
        "bordercolor": "#8B0000",
        "box": 1,
        "boxcolor": "#FF0000@0.75",
        "boxborderw": 10,
        "shadowx": 0, "shadowy": 0,
    },
    "purple_glow": {
        "fontcolor": "#E040FB",
        "borderw": 4,
        "bordercolor": "#1A0030",
        "box": 0,
        "shadowx": 3, "shadowy": 3,
        "shadowcolor": "#9C27B0",
    },
    "ice_white": {
        "fontcolor": "white",
        "borderw": 5,
        "bordercolor": "#0099CC",
        "box": 0,
        "shadowx": 4, "shadowy": 4,
        "shadowcolor": "#00CFFF@0.7",
    },
    "orange_pop": {
        "fontcolor": "#FF6600",
        "borderw": 4,
        "bordercolor": "#1A0000",
        "box": 0,
        "shadowx": 2, "shadowy": 2,
        "shadowcolor": "#FF3300",
    },
    "dark_glass": {
        "fontcolor": "white",
        "borderw": 2,
        "bordercolor": "black",
        "box": 1,
        "boxcolor": "black@0.5",
        "boxborderw": 18,
        "shadowx": 0, "shadowy": 0,
    },
    "yellow_stroke": {
        "fontcolor": "black",
        "borderw": 5,
        "bordercolor": "#FFD700",
        "box": 0,
        "shadowx": 3, "shadowy": 3,
        "shadowcolor": "#FFA500",
    },
    "cyan_glow": {
        "fontcolor": "white",
        "borderw": 0,
        "bordercolor": "black",
        "box": 1,
        "boxcolor": "#00BCD4@0.7",
        "boxborderw": 12,
        "shadowx": 4, "shadowy": 4,
        "shadowcolor": "#00E5FF",
    },
    "mrbeast": {
        "fontcolor": "#FFFF00",
        "borderw": 5,
        "bordercolor": "black",
        "box": 0,
        "shadowx": 4, "shadowy": 4,
        "shadowcolor": "black",
    },
}


import textwrap

def _hex_to_ass_color(color_str):
    color_str = color_str.strip().lower()
    alpha = "00"
    if "@" in color_str:
        parts = color_str.split("@")
        color_str = parts[0]
        alpha_val = int((1.0 - float(parts[1])) * 255)
        alpha = f"{alpha_val:02X}"

    if color_str == "white":
        return f"&H{alpha}FFFFFF"
    elif color_str == "black":
        return f"&H{alpha}000000"
    
    if color_str.startswith("#"):
        color_str = color_str[1:]
    if len(color_str) == 6:
        r, g, b = color_str[0:2], color_str[2:4], color_str[4:6]
        return f"&H{alpha}{b}{g}{r}".upper()
    return f"&H{alpha}FFFFFF"

import tempfile
import uuid

def _build_hook_ass_file(hook_text, style_key, out_w, out_h):
    s = HOOK_STYLES.get(style_key) or HOOK_STYLES["default"]
    
    primary = _hex_to_ass_color(s.get("fontcolor", "white"))
    outline_c = _hex_to_ass_color(s.get("bordercolor", "black"))
    back_c = _hex_to_ass_color(s.get("boxcolor", "black@0.5") if s.get("box") else s.get("shadowcolor", "black"))
    
    border_style = 3 if s.get("box") else 1
    outline_w = s.get("boxborderw", 10) if s.get("box") else s.get("borderw", 3)
    shadow_w = max(s.get("shadowx", 0), s.get("shadowy", 0))
    
    font = "Arial"
    fontsize = int(out_h * 0.055)
    
    # 8 = top center
    alignment = 8
    margin_v = int(out_h * 0.07)
    margin_lr = 60
    
    safe_hook_text = hook_text.replace("\\n", "\\N")
    
    ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {out_w}
PlayResY: {out_h}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{fontsize},{primary},&H000000FF,{outline_c},{back_c},1,0,0,0,100,100,0,0,{border_style},{outline_w},{shadow_w},{alignment},{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,1:00:00.00,Default,,0,0,0,,{safe_hook_text}
"""
    
    temp_path = os.path.join(tempfile.gettempdir(), f"hook_{uuid.uuid4().hex[:8]}.ass")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(ass_content)
    
    safe_path = str(temp_path).replace("\\", "/").replace(":", "\\:")
    return f"ass='{safe_path}'"


def _layout_filter(src_w, src_h, layout):
    """Returns a filtergraph fragment (string) implementing the chosen layout.
    Output is always 1080x1920."""
    out_w, out_h = 1080, 1920

    if layout == "bw_letterbox":
        # keep original aspect ratio, scale to fit width, pad top/bottom black
        return (
            f"scale={out_w}:-2:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:black"
        )

    if layout == "blur_bg":
        # split into two streams: one blurred+stretched to fill frame (background),
        # one scaled to fit width (foreground), overlay foreground centered
        return (
            f"split=2[bg][fg];"
            f"[bg]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
            f"crop={out_w}:{out_h},gblur=sigma=20[bgblur];"
            f"[fg]scale={out_w}:-2:force_original_aspect_ratio=decrease[fgscaled];"
            f"[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2"
        )

    if layout == "streamer":
        # keep original aspect ratio, scale to fit width, pad top/bottom white
        return (
            f"scale={out_w}:-2:force_original_aspect_ratio=decrease,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:white"
        )

    # fallback: legacy behaviour (no layout specified)
    return f"scale=trunc(iw/2)*2:trunc(ih/2)*2"


# ==========================
# Escape text for FFmpeg drawtext filter
# ==========================
def _escape_drawtext(text: str) -> str:
    """Escape a string so it is safe inside FFmpeg's drawtext text='...' value.

    When passing filters via subprocess (not through a shell), we only need
    one level of escaping for FFmpeg's filtergraph parser.
    To completely avoid the impossibility of putting a literal single quote
    inside a single-quoted FFmpeg string, we elegantly swap standard 
    apostrophes for typographic curly quotes.
    """
    text = text.replace("\n", " ").replace("\r", " ")
    
    # Replace standard single quotes with typographic curly quotes
    # This prevents the text='...' block from prematurely ending.
    text = text.replace("'", "’")
    
    # Escape backslashes
    text = text.replace("\\", "\\\\")
    
    # Escape colons just in case, though inside single quotes it's usually fine
    text = text.replace(":", "\\:")
    
    # Escape % so drawtext doesn't try to interpolate %{...}
    text = text.replace("%", "%%")
    
    return text


# ==========================
# Default font file for drawtext (avoids fontconfig)
# ==========================
_CACHED_FONTFILE = None

def _get_default_fontfile() -> str:
    """Return an absolute path to a .ttf font for FFmpeg drawtext.

    Using an explicit fontfile avoids fontconfig lookup which crashes on
    some Windows FFmpeg builds.  Tries Arial first, then Segoe UI, then
    any .ttf found in the system fonts directory.
    """
    global _CACHED_FONTFILE
    if _CACHED_FONTFILE:
        return _CACHED_FONTFILE

    fonts_dir = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
    candidates = ["arial.ttf", "arialbd.ttf", "segoeui.ttf", "tahoma.ttf"]
    for name in candidates:
        path = os.path.join(fonts_dir, name)
        if os.path.isfile(path):
            _CACHED_FONTFILE = path
            return path

    # Fallback: pick the first .ttf we find
    if os.path.isdir(fonts_dir):
        for f in os.listdir(fonts_dir):
            if f.lower().endswith(".ttf"):
                _CACHED_FONTFILE = os.path.join(fonts_dir, f)
                return _CACHED_FONTFILE

    # Last resort — let FFmpeg try fontconfig anyway
    _CACHED_FONTFILE = ""
    return ""


# ==========================
# Build filter chain
# ==========================
def build_filters(
    src_w, src_h,
    aspect="original",
    layout=None,            # full_vertical | bw_letterbox | blur_bg (overrides aspect if set)
    hook_text=None,
    hook_style="default",   # key into HOOK_STYLES
    zoom_punch=False,
    fade_in=0.3,
    fade_out=0.3,
    clip_duration=None,
    ass_path=None,
    emotion_peaks=None,
):
    vf_parts = []
    uses_complex_filter = False  # blur_bg uses split/overlay, needs different -filter_complex handling

    # ── 1. Aspect ratio / reframe ────────────────────────────────────────────
    if layout in LAYOUTS:
        layout_frag = _layout_filter(src_w, src_h, layout)
        vf_parts.append(layout_frag)
        uses_complex_filter = layout == "blur_bg"
        out_w, out_h = 1080, 1920

    elif aspect == "9:16":           # TikTok / Reels / Shorts (legacy path)
        crop_w = min(src_w, int(src_h * 9 / 16))
        crop_h = min(src_h, int(src_w * 16 / 9))
        cx = (src_w - crop_w) // 2
        cy = (src_h - crop_h) // 2
        vf_parts.append(f"crop={crop_w}:{crop_h}:{cx}:{cy}")
        vf_parts.append("scale=1080:1920:force_original_aspect_ratio=decrease")
        vf_parts.append("pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black")
        out_w, out_h = 1080, 1920

    elif aspect == "1:1":          # Instagram square
        side = min(src_w, src_h)
        cx = (src_w - side) // 2
        cy = (src_h - side) // 2
        vf_parts.append(f"crop={side}:{side}:{cx}:{cy}")
        vf_parts.append("scale=1080:1080")
        out_w, out_h = 1080, 1080

    elif aspect == "4:5":          # Instagram portrait
        crop_w = min(src_w, int(src_h * 4 / 5))
        crop_h = min(src_h, int(src_w * 5 / 4))
        cx = (src_w - crop_w) // 2
        cy = (src_h - crop_h) // 2
        vf_parts.append(f"crop={crop_w}:{crop_h}:{cx}:{cy}")
        vf_parts.append("scale=1080:1350")
        out_w, out_h = 1080, 1350

    else:                          # original – just ensure even dimensions
        vf_parts.append("scale=trunc(iw/2)*2:trunc(ih/2)*2")
        out_w, out_h = src_w, src_h

    # ── 2. Zoom punch / Zoom-on-emotion ─────────────────────────────────────
    # NOTE: skipped when blur_bg is active — zoompan on a filter_complex graph
    # needs a different chain position; keep blur_bg simple for now.
    if not uses_complex_filter and (zoom_punch or emotion_peaks):
        if emotion_peaks:
            # Chain conditionals for multiple heartbeat zooms
            z_expr = "1"
            for p in reversed(emotion_peaks):
                t_p = float(p.get("time", 0))
                # Heartbeat zoom: 1.0 -> 1.06 -> 1.0 over 0.5s using a sine wave
                z_expr = f"if(between(t,{t_p},{t_p+0.5}),1.0+0.06*sin(PI*(t-{t_p})/0.5),{z_expr})"
            vf_parts.append(
                f"zoompan=z='{z_expr}'"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d=1:s={out_w}x{out_h}:fps=30"
            )
        elif zoom_punch and clip_duration:
            fps_assumed = 30
            zoom_frames = int(fps_assumed * min(0.5, clip_duration * 0.2))
            if zoom_frames > 1:
                vf_parts.append(
                    f"zoompan=z='if(lte(on,{zoom_frames}),1.05-0.05*(on/{zoom_frames}),1)'"
                    f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                    f":d=1:s={out_w}x{out_h}:fps=30"
                )

    # ── 3. Hook text overlay (big bold opener) ───────────────────────────────
    if hook_text:
        vf_parts.append(
            _build_hook_ass_file(hook_text, hook_style or "default", out_w, out_h)
        )

    # ── 4. ASS karaoke subtitle burn-in (replaces old drawtext captions) ────
    if ass_path:
        # NOTE: ass_path here must already be a "safe" filesystem path
        # (no apostrophes, no unicode special chars, no spaces) — see
        # get_ffmpeg_safe_ass_path(). We still escape ':' and '\' for
        # ffmpeg's own filtergraph parser as a second line of defense.
        safe_ass_path = str(ass_path).replace("\\", "/").replace(":", "\\:")
        vf_parts.append(f"ass='{safe_ass_path}'")

    # ── 5. Fade in / out ─────────────────────────────────────────────────────
    if clip_duration:
        if fade_in > 0:
            vf_parts.append(f"fade=t=in:st=0:d={fade_in}")
        if fade_out > 0 and clip_duration > fade_out:
            fo_start = clip_duration - fade_out
            vf_parts.append(f"fade=t=out:st={fo_start:.3f}:d={fade_out}")

    return ",".join(vf_parts) if vf_parts else None, uses_complex_filter


# ==========================
# Make ASS path FFmpeg-filter-safe
# ==========================
def get_ffmpeg_safe_ass_path(ass_path):
    if not ass_path or not os.path.exists(ass_path):
        return ass_path

    safe_dir = os.path.join(tempfile.gettempdir(), "shorts_ass_cache")
    os.makedirs(safe_dir, exist_ok=True)

    safe_name = f"ass_{uuid.uuid4().hex[:10]}.ass"
    safe_path = os.path.join(safe_dir, safe_name)

    shutil.copyfile(ass_path, safe_path)
    return safe_path


# ==========================
# Caption-only pass (no crop/scale — used after autocrop already sized the frame)
# ==========================
def _burn_captions_only(
    video_path, output_path,
    ass_path=None, hook_text=None, hook_style="default", zoom_punch=False,
    fade_in=0.3, fade_out=0.3, clip_duration=None,
    normalize_audio=True, target_loudness=-14,
    emotion_peaks=None,
):
    src_w, src_h, _ = probe_video(video_path)
    safe_ass_path = get_ffmpeg_safe_ass_path(ass_path)

    # aspect="original" here just means "don't crop/pad again" — autocrop.py
    # already produced the correct 1080x1920 frame.
    vf, uses_complex = build_filters(
        src_w, src_h,
        aspect="original",
        layout=None,
        hook_text=hook_text,
        hook_style=hook_style,
        zoom_punch=zoom_punch,
        fade_in=fade_in,
        fade_out=fade_out,
        clip_duration=clip_duration,
        ass_path=safe_ass_path,
        emotion_peaks=emotion_peaks,
    )

    cmd = ["ffmpeg", "-y", "-i", video_path]
    if vf:
        cmd += (["-filter_complex", vf] if uses_complex else ["-vf", vf])

    cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]

    if normalize_audio:
        cmd += ["-af", f"loudnorm=I={target_loudness}:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    else:
        cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd.append(output_path)
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg (caption pass) failed:\n{result.stderr[-2000:]}")


# ==========================
# Get clip duration (for already-cut raw clips — no start/end given)
# ==========================
def _get_duration(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


# ==========================
# Render an ALREADY-CUT raw clip (from clip_cutter.py) — no start/end/source
# video needed, the file IS the clip. Used by the new pipeline:
#   Gemini moments -> clip_cutter (raw cut) -> whisper captions -> HERE
# ==========================
def render_raw_clip(
    raw_clip_path, output_path,
    layout=None, aspect="original", ass_path=None,
    hook_text=None, hook_style="default", zoom_punch=False, fade_in=0.3, fade_out=0.3,
    normalize_audio=True, target_loudness=-14,
    emotion_peaks=None,
):
    duration = _get_duration(raw_clip_path)
    final_output_path = output_path

    if layout == "original":
        aspect = "original"
        layout = None

    # bw_letterbox / blur_bg / original — single pass, no source trimming needed
    src_w, src_h, _ = probe_video(raw_clip_path)
    safe_ass_path = get_ffmpeg_safe_ass_path(ass_path)

    vf, uses_complex = build_filters(
        src_w, src_h,
        aspect=aspect, layout=layout,
        hook_text=hook_text, hook_style=hook_style, zoom_punch=zoom_punch,
        fade_in=fade_in, fade_out=fade_out,
        clip_duration=duration, ass_path=safe_ass_path,
        emotion_peaks=emotion_peaks,
    )

    cmd = ["ffmpeg", "-y", "-i", raw_clip_path]
    if vf:
        cmd += (["-filter_complex", vf] if uses_complex else ["-vf", vf])
    cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    if normalize_audio:
        cmd += ["-af", f"loudnorm=I={target_loudness}:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    else:
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    cmd.append(output_path)

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-2000:]}")
            
    return final_output_path


def process_raw_clips_multi_template(
    raw_clip_records, output_dir, ass_path_map, templates,
    layout=None, position="bottom",
    zoom_punch=False, fade_in=0.3, fade_out=0.3, normalize_audio=True,
):
    """
    Renders already-cut raw clips (from clip_cutter.py) with MULTIPLE
    caption templates each. This is the new-pipeline equivalent of
    process_clips_multi_template, but takes pre-cut clips + a
    per-template ASS-file map instead of cutting from the source video.

    raw_clip_records: [{"clip_number","raw_path","hook_text",...}, ...]
        (as returned by clip_cutter.cut_all_raw_clips)
    ass_path_map: {template: {clip_number: ass_path}} — generate this by
        calling generate_ass.build_ass_from_whisper_words per clip per
        template beforehand (words should already be Hinglish-corrected).

    Returns {template: {clip_number: output_path_or_None}}.
    """
    os.makedirs(output_dir, exist_ok=True)

    results = {template: {} for template in templates}

    for template in templates:
        print(f"\n########## Rendering template: {template} ##########\n")
        for rec in raw_clip_records:
            clip_number = rec["clip_number"]
            raw_path = rec.get("raw_path")
            hook_text = rec.get("hook_text") or rec.get("hook")
            hook_style = rec.get("hook_style") or "default"

            if not raw_path or not os.path.exists(raw_path):
                print(f"   ❌ Clip {clip_number}: raw clip missing, skipping")
                results[template][clip_number] = None
                continue

            ass_path = ass_path_map.get(template, {}).get(clip_number)
            output_path = os.path.join(output_dir, f"final_{clip_number}__{template}.mp4")

            try:
                render_raw_clip(
                    raw_path, output_path,
                    layout=layout, ass_path=ass_path, hook_text=hook_text, hook_style=hook_style,
                    zoom_punch=zoom_punch, fade_in=fade_in, fade_out=fade_out,
                    normalize_audio=normalize_audio,
                    emotion_peaks=rec.get("emotion_peaks"),
                )
                print(f"   ✅ Clip {clip_number} ({template}) → {output_path}")
                results[template][clip_number] = output_path
            except Exception as e:
                print(f"   ❌ Clip {clip_number} ({template}) failed: {e}")
                results[template][clip_number] = None

    return results


def process_raw_clips_multi_layout_template(
    raw_clip_records, output_dir, ass_path_map, templates, layouts,
    position="bottom",
    zoom_punch=False, fade_in=0.3, fade_out=0.3, normalize_audio=True,
    sfx_volume=100,
):
    """
    Renders already-cut raw clips across MULTIPLE layouts AND MULTIPLE
    caption templates — e.g. 2 layouts x 3 templates = 6 output variants
    per clip. YOLO crop (full_vertical) is still cached once per
    (layout, clip) — not once per (layout, template, clip) — since it's
    layout-dependent, not template-dependent.

    layouts: list of layout names, e.g. ["full_vertical", "streamer"]
    ass_path_map: {template: {clip_number: ass_path}} — same as
        process_raw_clips_multi_template (captions don't depend on layout)

    Returns {layout: {template: {clip_number: output_path_or_None}}}.
    """
    os.makedirs(output_dir, exist_ok=True)

    results = {layout: {template: {} for template in templates} for layout in layouts}

    for layout in layouts:
        for template in templates:
            print(f"\n########## Rendering layout={layout} template={template} ##########\n")
            for rec in raw_clip_records:
                clip_number = rec["clip_number"]
                raw_path = rec.get("raw_path")
                hook_text = rec.get("hook_text") or rec.get("hook")
                hook_style = rec.get("hook_style") or "default"

                if not raw_path or not os.path.exists(raw_path):
                    print(f"   ❌ Clip {clip_number}: raw clip missing, skipping")
                    results[layout][template][clip_number] = None
                    continue

                ass_path = ass_path_map.get(template, {}).get(clip_number)
                output_path = os.path.join(output_dir, f"final_{clip_number}__{layout}__{template}.mp4")

                try:
                    render_raw_clip(
                        raw_path, output_path,
                        layout=layout, ass_path=ass_path, hook_text=hook_text, hook_style=hook_style,
                        zoom_punch=zoom_punch, fade_in=fade_in, fade_out=fade_out,
                        normalize_audio=normalize_audio,
                        emotion_peaks=rec.get("emotion_peaks"),
                    )
                    print(f"   ✅ Clip {clip_number} ({layout}, {template}) → {output_path}")
                    results[layout][template][clip_number] = output_path
                except Exception as e:
                    print(f"   ❌ Clip {clip_number} ({layout}, {template}) failed: {e}")
                    results[layout][template][clip_number] = None

    return results


# ==========================
# FFmpeg Cutter (enhanced) — CUT + ASS BURN IN ONE PASS
# ==========================
def cut_clip(
    video_path, start, end, output_path,
    aspect="original",
    layout=None,              # NEW
    ass_path=None,
    hook_text=None,
    hook_style="default",
    zoom_punch=False,
    fade_in=0.3,
    fade_out=0.3,
    normalize_audio=True,
    target_loudness=-14,   # LUFS — Spotify/YouTube standard
):
    duration = float(end) - float(start)

    # ── "original" layout — keep native aspect ratio, no crop/pad at all.
    # Maps straight onto the legacy aspect="original" single-pass path below.
    if layout == "original":
        aspect = "original"
        layout = None

    # ── all other layouts (bw_letterbox, blur_bg, legacy aspect) — single pass ──
    src_w, src_h, _ = probe_video(video_path)

    safe_ass_path = get_ffmpeg_safe_ass_path(ass_path)

    vf, uses_complex = build_filters(
        src_w, src_h,
        aspect=aspect,
        layout=layout,
        hook_text=hook_text,
        hook_style=hook_style,
        zoom_punch=zoom_punch,
        fade_in=fade_in,
        fade_out=fade_out,
        clip_duration=duration,
        ass_path=safe_ass_path,
    )

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-i", video_path,
        "-t", str(duration),
    ]

    if vf:
        # blur_bg layout uses split/overlay (a graph, not a linear chain) —
        # -filter_complex is required instead of -vf for that case.
        cmd += (["-filter_complex", vf] if uses_complex else ["-vf", vf])

    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
    ]

    if normalize_audio:
        cmd += [
            "-af", f"loudnorm=I={target_loudness}:TP=-1.5:LRA=11",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
        ]
    else:
        cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd.append(output_path)

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-2000:]}")


# ==========================
# Resolve ASS file for a given clip
# ==========================
def resolve_ass_path(clip, clip_number, ass_files):
    if not ass_files:
        return None

    if isinstance(ass_files, dict):
        return ass_files.get(clip_number) or ass_files.get(str(clip_number))

    if isinstance(ass_files, (list, tuple)):
        idx = clip_number - 1 if isinstance(clip_number, int) else None
        if idx is not None and 0 <= idx < len(ass_files):
            return ass_files[idx]
        for p in ass_files:
            if f"clip_{clip_number}" in str(p) or f"_{clip_number}." in str(p):
                return p

    return None


# ==========================
# Single-clip render (used by server.py for layout-switch / re-export)
# ==========================
def render_single_clip(
    video_path, start, end, output_path,
    layout=None, aspect="original", ass_path=None,
    hook_text=None, zoom_punch=False, fade_in=0.3, fade_out=0.3,
    normalize_audio=True,
):
    """Re-render exactly one clip — same underlying logic as process_clips'
    per-clip loop, but callable directly with a single start/end window.
    Used by the API for layout switches and re-exports without re-running
    the whole batch."""
    cut_clip(
        video_path, start, end, output_path,
        aspect=aspect,
        layout=layout,
        ass_path=ass_path,
        hook_text=hook_text,
        zoom_punch=zoom_punch,
        fade_in=fade_in,
        fade_out=fade_out,
        normalize_audio=normalize_audio,
    )
    return output_path


# ==========================
# Main Processor
# ==========================
def process_clips(
    video_path,
    clips_json_path,
    output_dir,
    ass_files=None,
    aspect="original",
    layout=None,          # NEW: full_vertical | bw_letterbox | blur_bg | streamer | original
    zoom_punch=False,
    normalize_audio=True,
    fade_in=0.3,
    fade_out=0.3,
    template_label=None,  # NEW: tags output filenames, e.g. "final_1_title__alex_hormozi.mp4" —
                          # required when rendering the same clips with multiple caption templates
                          # in one run, so each template's output doesn't overwrite the last.
):
    data = load_clips(clips_json_path)
    clips = data.get("clips", [])

    if not clips:
        raise ValueError("No clips found in JSON")

    global_hook = data.get("hook_text")

    os.makedirs(output_dir, exist_ok=True)

    print("\n==============================")
    print(f"Starting Clip Generation  [{layout or aspect}]" + (f"  template={template_label}" if template_label else ""))
    print("==============================\n")

    output_paths = []

    for i, clip in enumerate(clips):
        clip_number = clip.get("clip", i + 1)
        title = clip.get("title", f"clip_{clip_number}")

        title_safe = re.sub(r"[^\w\s-]", "", title).strip()
        title_safe = re.sub(r"[\s]+", "_", title_safe)[:60]

        start = float(clip["start"])
        end   = float(clip["end"])
        duration = end - start

        clip_aspect = clip.get("aspect", aspect)
        clip_layout = clip.get("layout", layout)   # per-clip override, falls back to global
        clip_hook   = clip.get("hook_text", global_hook)
        clip_hook_style = clip.get("hook_style", "default")
        clip_zoom   = clip.get("zoom_punch", zoom_punch)

        ass_path = resolve_ass_path(clip, clip_number, ass_files)

        suffix = f"__{template_label}" if template_label else ""
        output_path = os.path.join(output_dir, f"final_{clip_number}_{title_safe}{suffix}.mp4")

        print(f"✂  Clip {clip_number}: {start:.2f}s → {end:.2f}s  |  layout={clip_layout or clip_aspect}  |  ass={ass_path}")

        try:
            cut_clip(
                video_path, start, end, output_path,
                aspect=clip_aspect,
                layout=clip_layout,
                ass_path=ass_path,
                hook_text=clip_hook,
                hook_style=clip_hook_style,
                zoom_punch=clip_zoom,
                fade_in=fade_in,
                fade_out=fade_out,
                normalize_audio=normalize_audio,
            )
            print(f"   ✅ Saved  → {output_path}")
            output_paths.append(output_path)

        except Exception as e:
            print(f"   ❌ Failed clip {clip_number}: {e}")
            output_paths.append(None)

        print()

    print("==============================")
    print("All Clips Generated")
    print("==============================\n")

    return output_paths


def process_clips_multi_template(
    video_path, clips_json_path, output_dir, transcript_path, workspace,
    templates, position="bottom", layout=None, generate_ass_fn=None,
    **process_clips_kwargs,
):
    """
    Renders the SAME clips with MULTIPLE caption templates in one run — e.g.
    to compare 3+ styles per clip before picking a favorite. For each
    template: regenerates .ass files with that template, then re-renders
    all clips tagged with that template's name in the filename.

    For full_vertical layouts, the expensive YOLO+face-tracking
    crop runs ONCE per clip (cached), not once per template — only the cheap
    caption-burn pass repeats per template.

    templates: list of template names, e.g. ["alex_hormozi", "mrbeast", "podcast"]
    generate_ass_fn: the generate_all_ass function to call (imported by the
        caller to avoid a circular import here — pass generate_ass.generate_all_ass).

    Returns {template_name: {"output_paths": [...], "ass_files": [...]}} —
    both lists in clip order, so callers can store per-clip ass_path for
    later re-renders (layout switch, export).
    """
    if len(templates) < 1:
        raise ValueError("Provide at least one template")
    if generate_ass_fn is None:
        raise ValueError("generate_ass_fn is required (pass generate_ass.generate_all_ass)")

    results = {}
    for template in templates:
        print(f"\n########## Rendering template: {template} ##########\n")
        ass_files = generate_ass_fn(
            transcript_path=transcript_path,
            clips_json_path=clips_json_path,
            workspace=workspace,
            template=template,
            position=position,
        )
        output_paths = process_clips(
            video_path=video_path,
            clips_json_path=clips_json_path,
            output_dir=output_dir,
            ass_files=ass_files,
            layout=layout,
            template_label=template,
            **process_clips_kwargs,
        )
        results[template] = {"output_paths": output_paths, "ass_files": ass_files}

    return results


# ==========================
# CLI
# ==========================
ASPECTS = ["original", "9:16", "1:1", "4:5"]

if __name__ == "__main__":
    video_path = input("Enter video path: ").strip()
    clips_json = input("Enter clips.json path: ").strip()
    output_dir = input("Enter output folder: ").strip()

    print("\nLayout options:")
    labels = {
        "bw_letterbox": "Original ratio + black letterbox",
        "blur_bg": "Original ratio + blurred background fill",
        "streamer": "9:16 padded with white canvas",
        "original": "Native aspect ratio, no crop/pad at all",
    }
    for idx, l in enumerate(LAYOUTS):
        print(f"  {idx}) {l}  —  {labels[l]}")

    choice = input("\nPick layout (0-2, blank to use legacy aspect flow): ").strip()
    layout = LAYOUTS[int(choice)] if choice.isdigit() and int(choice) < len(LAYOUTS) else None

    aspect = "original"
    if layout is None:
        print("\nAspect ratio options:")
        for idx, a in enumerate(ASPECTS):
            labels = {
                "original": "YouTube / Twitter",
                "9:16": "TikTok / Reels / Shorts",
                "1:1": "Instagram square",
                "4:5": "Instagram portrait",
            }
            print(f"  {idx}) {a}  —  {labels[a]}")
        a_choice = input("\nPick aspect (0-3, default 0): ").strip()
        aspect = ASPECTS[int(a_choice)] if a_choice.isdigit() and int(a_choice) < len(ASPECTS) else "original"

    zoom   = input("Zoom punch intro? (y/n, default n): ").strip().lower() == "y"
    norm   = input("Normalize audio loudness? (y/n, default y): ").strip().lower() != "n"

    process_clips(
        video_path, clips_json, output_dir,
        aspect=aspect,
        layout=layout,
        zoom_punch=zoom,
        normalize_audio=norm,
    )