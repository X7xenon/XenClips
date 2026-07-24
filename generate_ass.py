import json
import os


# =========================
# LOAD JSON
# =========================

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =========================
# ASS TIME FORMAT
# =========================

def to_ass_time(seconds: float) -> str:
    seconds = max(0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs == 100:
        cs = 0
        s += 1
        if s == 60:
            s = 0
            m += 1
            if m == 60:
                m = 0
                h += 1
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


# =========================
# GET CLIP SUBTITLES (segment-level, absolute video time)
# =========================

def get_subs(transcript, start, end):
    subs = []
    for item in transcript:
        if item["start"] <= end and item["end"] >= start:
            subs.append(item)
    return subs


def shift_to_clip_relative(sub, clip_start, clip_end):
    rel_start = max(0.0, sub["start"] - clip_start)
    rel_end = min(clip_end - clip_start, sub["end"] - clip_start)
    if rel_end <= rel_start:
        rel_end = rel_start + 0.05
    return rel_start, rel_end


# =========================
# WORD INTERPOLATION
# =========================
# transcript.json comes from YouTube's own captions (segment/phrase-level) —
# NOT word-level. For word-by-word templates we approximate per-word timing
# by distributing each segment's duration proportionally by character length.

def _interpolate_words(segment):
    text = segment["text"].strip()
    words = text.split()
    if not words:
        return []

    total_chars = sum(len(w) for w in words) or 1
    seg_start = segment["start"]
    seg_dur = segment["end"] - segment["start"]

    result = []
    cursor = seg_start
    for w in words:
        w_dur = seg_dur * (len(w) / total_chars)
        result.append({"text": w, "start": cursor, "end": cursor + w_dur})
        cursor += w_dur
    return result


def _get_words(transcript, start, end):
    segments = get_subs(transcript, start, end)
    words = []
    for seg in segments:
        words.extend(_interpolate_words(seg))
    return words


def _group_words(words, max_words=3, max_chars=20):
    chunks = []
    current = []
    current_len = 0
    for w in words:
        text = w["text"].strip()
        if not text:
            continue
        projected_len = current_len + len(text) + 1
        if current and (len(current) >= max_words or projected_len > max_chars):
            chunks.append(current)
            current = []
            current_len = 0
        current.append(w)
        current_len += len(text) + 1
    if current:
        chunks.append(current)
    return chunks


def _alignment_for(position):
    return {"top": 8, "center": 5, "bottom": 2}[position]


def _margin_v_for(position, base_bottom_margin):
    return {"top": 40, "center": 0, "bottom": base_bottom_margin}[position]


# =========================
# ANIMATION TAGS (applied as an ASS override prefix on a word/line)
# =========================
# libass supports \t transforms, \alpha, \fscx/\fscy, \blur — used here to
# approximate each style's described animation. All are self-contained
# override blocks that reset naturally at the next \r or line end.

ANIMATIONS = {
    "none": "",
    "popin": r"{\fscx60\fscy60\t(0,120,\fscx100\fscy100)}",
    "popin_fast": r"{\fscx55\fscy55\t(0,80,\fscx105\fscy105)\t(80,130,\fscx100\fscy100)}",
    "bounce": r"{\fscx50\fscy50\t(0,90,\fscx115\fscy115)\t(90,160,\fscx100\fscy100)}",
    "fade": r"{\alpha&HFF&\t(0,150,\alpha&H00&)}",
    "fade_scale": r"{\fscx90\fscy90\alpha&HFF&\t(0,180,\fscx100\fscy100\alpha&H00&)}",
    "zoom": r"{\fscx55\fscy55\t(0,220,\fscx120\fscy120)\t(220,380,\fscx100\fscy100)}",
    "shake": r"{\fscx100\fscy100\t(0,60,\fscx108\fscy92)\t(60,120,\fscx92\fscy108)\t(120,180,\fscx100\fscy100)}",
    "blur_sharp": r"{\blur6\t(0,200,\blur0)}",
    "glitch": r"{\fscx100\fscy100\t(0,30,\fscx110\fscy90)\t(30,60,\fscx90\fscy110)\t(60,90,\fscx100\fscy100)}",
    "rotate_in": r"{\frz-15\fscx50\fscy50\t(0,150,\frz0\fscx100\fscy100)}",
    "pulse": r"{\fscx100\fscy100\t(0,100,\fscx110\fscy110)\t(100,200,\fscx100\fscy100)}",
}


# =========================
# TEMPLATE CONFIGS
# =========================
# Each config drives both the ASS [V4+ Styles] line and the per-word/per-line
# rendering logic. Colors are ASS inline/BBGGRR format.

TEMPLATE_CONFIGS = {
    "alex_hormozi": dict(
        font="Arial Black", size=105, outline=7, shadow=0, box=False, bold=1,
        max_words=2, uppercase=True, highlight="&H0000FFFF&",  # yellow
        animation="popin", keyword_only=False, mode="word",
    ),
    "mrbeast": dict(
        font="Arial Black", size=115, outline=9, shadow=0, box=False, bold=1,
        max_words=2, uppercase=True, highlight="&H001AFF1A&",  # bright green
        animation="bounce", keyword_only=False, mode="word",
    ),
    "iman_gadzhi": dict(
        font="Arial", size=95, outline=0, shadow=4, box=False, bold=0,
        max_words=3, uppercase=False, highlight="&H0000FFFF&",  # yellow, keywords only
        animation="fade", keyword_only=True, mode="word",
    ),
    "ali_abdaal": dict(
        font="Segoe UI", size=85, outline=0, shadow=4, box=False, bold=0,
        max_words=3, uppercase=False, highlight="&H00F48542&",  # blue accent
        animation="fade_scale", keyword_only=False, mode="word",
    ),
    "podcast": dict(
        font="Arial", size=90, outline=0, shadow=0, box=True, bold=1,
        max_words=3, uppercase=False, highlight="&H0000FFFF&",  # yellow active word
        animation="none", keyword_only=False, mode="word",
    ),
    "gaming": dict(
        font="Impact", size=115, outline=6, shadow=0, box=False, bold=0,
        max_words=2, uppercase=True, highlight="&H00FF00FF&",  # magenta active word
        animation="shake", keyword_only=False, mode="word",
        primary_override="&H00FFFF00",  # cyan base text
        outline_color_override="&H00FF00FF",  # purple outline
    ),
    "motivational": dict(
        font="Impact", size=130, outline=9, shadow=0, box=False, bold=0,
        max_words=2, uppercase=True, highlight="&H0000A5FF&",  # orange/gold
        animation="zoom", keyword_only=False, mode="word",
    ),
    "minimal_clean": dict(
        font="Arial", size=75, outline=0, shadow=3, box=False, bold=0,
        max_words=4, uppercase=False, highlight=None,
        animation="fade", keyword_only=False, mode="phrase",
    ),
    "tiktok_viral": dict(
        font="Arial Black", size=105, outline=7, shadow=0, box=False, bold=1,
        max_words=2, uppercase=True, highlight="&H000000FF&",  # red
        animation="popin_fast", keyword_only=False, mode="word",
    ),
    "premium_cinematic": dict(
        font="Georgia", size=90, outline=0, shadow=5, box=False, bold=0,
        max_words=3, uppercase=False, highlight="&H0000D7FF&",  # gold
        animation="blur_sharp", keyword_only=False, mode="word",
    ),
    "cyberpunk": dict(
        font="Consolas", size=95, outline=4, shadow=0, box=False, bold=1,
        max_words=2, uppercase=True, highlight="&H00FF00FF&", # magenta
        animation="glitch", keyword_only=False, mode="word",
        primary_override="&H0000FF00", # green text
        outline_color_override="&H00FF0000", # blue outline
    ),
    "hacker": dict(
        font="Consolas", size=85, outline=0, shadow=0, box=True, bold=1,
        max_words=3, uppercase=False, highlight="&H00FFFFFF&", # white highlight
        animation="none", keyword_only=False, mode="word",
        primary_override="&H0000FF00", # green text
    ),
    "dreamy": dict(
        font="Comic Sans MS", size=90, outline=0, shadow=4, box=False, bold=1,
        max_words=3, uppercase=False, highlight="&H00FFB4FF&", # pastel pink
        animation="pulse", keyword_only=False, mode="word",
    ),
    "news_flash": dict(
        font="Trebuchet MS", size=90, outline=0, shadow=0, box=True, bold=1,
        max_words=4, uppercase=True, highlight="&H000000FF&", # red active
        animation="none", keyword_only=False, mode="phrase",
        primary_override="&H00FFFFFF",
    ),
    "y2k_bubbly": dict(
        font="Comic Sans MS", size=105, outline=5, shadow=0, box=False, bold=1,
        max_words=2, uppercase=True, highlight="&H0000FFFF&",
        animation="rotate_in", keyword_only=False, mode="word",
        primary_override="&H00FF00FF", # magenta
        outline_color_override="&H00000000",
    ),
}

# small heuristic list for "keyword highlights only" (Iman Gadzhi style) —
# no real NLP available from segment-level YouTube captions, so this
# approximates "important word" as long words + a short list of impact terms.
_KEYWORD_HINTS = {
    "never", "always", "secret", "proven", "system", "result", "results",
    "success", "free", "money", "viral", "mistake", "biggest", "truth",
    "warning", "guarantee", "exactly", "instantly",
}


def _is_keyword(word: str) -> bool:
    clean = word.strip(".,!?:;\"'()").lower()
    return len(clean) >= 7 or clean in _KEYWORD_HINTS


def _style_line(cfg, position, font_size_override=None):
    border_style = 3 if cfg["box"] else 1
    primary = cfg.get("primary_override", "&H00FFFFFF")  # default white
    outline_color = cfg.get("outline_color_override", "&H00000000")  # default black
    back = "&H00000000" if cfg["box"] else "&H00000000"
    size = font_size_override if font_size_override else cfg["size"]
    return (
        f"Style: Default,{cfg['font']},{size},{primary},&H000000FF,{outline_color},{back},"
        f"{cfg['bold']},0,0,0,100,100,0,0,{border_style},{cfg['outline']},{cfg['shadow']},"
        f"{_alignment_for(position)},10,10,{_margin_v_for(position, 320)},1"
    )


HEADER_TEMPLATE = """[Script Info]
Title: Clip Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


# =========================
# WORD-MODE BUILDER (per-word tiling, active word highlighted + animated)
# =========================

def _build_word_mode(transcript, start, end, cfg, words_override=None, max_words_override=None):
    words = words_override if words_override is not None else _get_words(transcript, start, end)
    if not words:
        return []

    max_words = max_words_override if max_words_override else cfg["max_words"]
    anim_tag = ANIMATIONS.get(cfg["animation"], "")
    lines = []

    for chunk in _group_words(words, max_words=max_words, max_chars=max_words * 7):
        chunk_texts = [w["text"].strip().upper() if cfg["uppercase"] else w["text"].strip() for w in chunk]

        for i, w in enumerate(chunk):
            w_start, w_end = shift_to_clip_relative(w, start, end)
            parts = []
            for j, t in enumerate(chunk_texts):
                is_active = (j == i)
                should_highlight = is_active and cfg["highlight"] and (
                    not cfg["keyword_only"] or _is_keyword(t)
                )
                if should_highlight:
                    parts.append(f"{anim_tag}{{\\1c{cfg['highlight']}}}{t}{{\\r}}")
                else:
                    parts.append(t)
            text = " ".join(parts)
            lines.append(f"Dialogue: 0,{to_ass_time(w_start)},{to_ass_time(w_end)},Default,,0,0,0,,{text}\n")

    return lines


# =========================
# PHRASE-MODE BUILDER (whole chunk static, animation applied once per chunk)
# =========================

def _build_phrase_mode(transcript, start, end, cfg, words_override=None, max_words_override=None):
    words = words_override if words_override is not None else _get_words(transcript, start, end)
    if not words:
        return []

    max_words = max_words_override if max_words_override else cfg["max_words"]
    anim_tag = ANIMATIONS.get(cfg["animation"], "")
    lines = []

    for chunk in _group_words(words, max_words=max_words, max_chars=max_words * 7):
        chunk_texts = [w["text"].strip().upper() if cfg["uppercase"] else w["text"].strip() for w in chunk]
        chunk_start, _ = shift_to_clip_relative(chunk[0], start, end)
        _, chunk_end = shift_to_clip_relative(chunk[-1], start, end)
        text = anim_tag + " ".join(chunk_texts)
        lines.append(f"Dialogue: 0,{to_ass_time(chunk_start)},{to_ass_time(chunk_end)},Default,,0,0,0,,{text}\n")

    return lines


def _build_for(template, transcript, start, end, words_override=None, max_words_override=None):
    cfg = TEMPLATE_CONFIGS[template]
    if cfg["mode"] == "phrase":
        return _build_phrase_mode(transcript, start, end, cfg, words_override=words_override, max_words_override=max_words_override)
    return _build_word_mode(transcript, start, end, cfg, words_override=words_override, max_words_override=max_words_override)


# =========================
# BUILD SINGLE CLIP ASS
# =========================

def build_clip_ass(transcript, clip, output_path, template="alex_hormozi", position="bottom", max_words=None, font_size=None):
    if template not in TEMPLATE_CONFIGS:
        raise ValueError(f"Unknown caption template '{template}'. Options: {list(TEMPLATE_CONFIGS)}")
    if position not in ("bottom", "center", "top"):
        raise ValueError(f"Unknown position '{position}'. Options: bottom, center, top")

    start = float(clip["start"])
    end = float(clip["end"])

    cfg = TEMPLATE_CONFIGS[template]
    header = HEADER_TEMPLATE.format(style_line=_style_line(cfg, position, font_size_override=font_size))
    lines = [header]
    lines.extend(_build_for(template, transcript, start, end, max_words_override=max_words))

    with open(output_path, "w", encoding="utf-8") as f:
        f.writelines(lines)


# =========================
# NEW FLOW: build ASS directly from Whisper's real word-level output
# =========================
# Used when captions come from whisper_transcriber.transcribe_clip_words()
# on an already-cut raw clip — timestamps are real (not interpolated) and
# already clip-relative (0 = clip start), so no shifting/interpolation needed.

def build_ass_from_whisper_words(words, output_path, template="alex_hormozi", position="bottom", max_words=None, font_size=None):
    """
    words: list of {"text","start","end"} with clip-relative real timestamps,
           as returned by whisper_transcriber.transcribe_clip_words().
    max_words: override how many words appear on screen at once (default is
        template-specific, e.g. 3 for alex_hormozi, 6 for minimal_clean).
    font_size: override the template's default caption font size.
    """
    if template not in TEMPLATE_CONFIGS:
        raise ValueError(f"Unknown caption template '{template}'. Options: {list(TEMPLATE_CONFIGS)}")
    if position not in ("bottom", "center", "top"):
        raise ValueError(f"Unknown position '{position}'. Options: bottom, center, top")

    cfg = TEMPLATE_CONFIGS[template]
    header = HEADER_TEMPLATE.format(style_line=_style_line(cfg, position, font_size_override=font_size))

    # start=0 end=duration so shift_to_clip_relative is a no-op passthrough
    # (words are already 0-based) while still clamping to clip bounds.
    duration = max((w["end"] for w in words), default=0.0)
    lines = [header]
    lines.extend(_build_for(template, transcript=None, start=0.0, end=duration, words_override=words, max_words_override=max_words))

    with open(output_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    return output_path


def generate_all_ass_from_whisper(clip_word_map, workspace, template="alex_hormozi", position="bottom", max_words=None, font_size=None):
    """
    clip_word_map: {clip_number (int): words_list} — typically built by running
    whisper_transcriber.transcribe_clips_batch() over clip_cutter's raw clips
    and keying the results by clip_number.

    Returns {clip_number: ass_path}.
    """
    clips_dir = os.path.join(workspace, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    print(f"\nGenerating per-clip ASS files from Whisper words (template='{template}', position='{position}')...\n")

    ass_paths = {}
    for clip_number, words in clip_word_map.items():
        output_path = os.path.join(clips_dir, f"clip_{clip_number}.ass")
        build_ass_from_whisper_words(words, output_path, template=template, position=position, max_words=max_words, font_size=font_size)
        ass_paths[clip_number] = output_path
        print(f"✔ Clip {clip_number} ASS saved ({len(words)} words): {output_path}")

    return ass_paths


# =========================
# MAIN GENERATOR
# =========================

def generate_all_ass(transcript_path, clips_json_path, workspace, template="alex_hormozi", position="bottom"):
    transcript = load_json(transcript_path)
    clips = load_json(clips_json_path)["clips"]

    clips_dir = os.path.join(workspace, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    print(f"\nGenerating per-clip ASS files (template='{template}', position='{position}')...\n")

    ass_files = []
    for i, clip in enumerate(clips, start=1):
        clip_template = clip.get("caption_template", template)
        clip_position = clip.get("caption_position", position)
        output_path = os.path.join(clips_dir, f"clip_{i}.ass")
        build_clip_ass(transcript, clip, output_path, template=clip_template, position=clip_position)
        ass_files.append(output_path)
        print(f"✔ Clip {i} ASS saved ({clip_template}, {clip_position}): {output_path}")

    return ass_files


# =========================
# TEST
# =========================

if __name__ == "__main__":
    transcript_path = input("Transcript JSON: ").strip()
    clips_path = input("Clips JSON: ").strip()
    workspace = input("Workspace folder: ").strip()

    print(f"\nAvailable templates: {list(TEMPLATE_CONFIGS)}")
    template = input("Template (default alex_hormozi): ").strip() or "alex_hormozi"
    position = input("Position - bottom/center/top (default bottom): ").strip() or "bottom"

    generate_all_ass(transcript_path, clips_path, workspace, template=template, position=position)

    print("\nDONE 🚀")