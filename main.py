from pipeline import run_pipeline, MIN_TEMPLATES, MIN_LAYOUTS

LAYOUTS = ["full_vertical", "bw_letterbox", "blur_bg", "ishowspeed", "original"]
TEMPLATES = [
    "alex_hormozi", "mrbeast", "iman_gadzhi", "ali_abdaal", "podcast",
    "gaming", "motivational", "minimal_clean", "tiktok_viral", "premium_cinematic",
]
POSITIONS = ["bottom", "center", "top"]


def _pick(prompt, options, default):
    print(f"\n{prompt}")
    for i, opt in enumerate(options):
        marker = " (default)" if opt == default else ""
        print(f"  {i}) {opt}{marker}")
    choice = input(f"Pick (0-{len(options)-1}, blank for default): ").strip()
    if choice.isdigit() and int(choice) < len(options):
        return options[int(choice)]
    return default


def _pick_multi(prompt, options, min_count):
    print(f"\n{prompt}")
    for i, opt in enumerate(options):
        print(f"  {i}) {opt}")
    label = "at least 1" if min_count <= 1 else f"at least {min_count}"
    print(f"\nPick {label} (comma-separated numbers, e.g. 0,1,4):")
    while True:
        raw = input("Selection: ").strip()
        indices = [x.strip() for x in raw.split(",") if x.strip()]
        if all(x.isdigit() and int(x) < len(options) for x in indices) and len(indices) >= min_count:
            seen = []
            for x in indices:
                name = options[int(x)]
                if name not in seen:
                    seen.append(name)
            return seen
        print(f"⚠  Need {label} valid number(s) — try again.")


def _pick_int(prompt, default):
    raw = input(f"{prompt} (blank for default: {default}): ").strip()
    return int(raw) if raw.isdigit() else default


def main():
    print("=" * 60)
    print("🔥 YouTube Shorts Automation PIPELINE")
    print("=" * 60)

    url = input("\nEnter YouTube URL:\n\n").strip()

    layouts = _pick_multi("Video layout(s) — pick any number:", LAYOUTS, MIN_LAYOUTS)
    templates = _pick_multi("Caption templates (render each clip in ALL of these):", TEMPLATES, MIN_TEMPLATES)
    position = _pick("Caption position:", POSITIONS, "bottom")

    print("\nCaption sizing (blank = use each template's default):")
    max_words = _pick_int("Words per line", None) if input("Customize words-per-line? (y/n, default n): ").strip().lower() == "y" else None
    font_size = _pick_int("Font size", None) if input("Customize font size? (y/n, default n): ").strip().lower() == "y" else None

    total_variants = len(layouts) * len(templates)
    print(f"\nPipeline: Download → Transcript (for Gemini) → Viral Clips → Raw Cut → "
          f"Whisper Captions → Hinglish Correction → Subtitles → Render "
          f"({len(layouts)} layout(s) × {len(templates)} template(s) = {total_variants} variant(s) per clip)\n")

    if any(l in ("full_vertical", "ishowspeed") for l in layouts):
        print("⚠  full_vertical/ishowspeed use smart YOLO+face-tracking crop — slow on CPU,")
        print("   but cached once per layout (not repeated per template).\n")

    try:
        result = run_pipeline(
            url, layouts=layouts, templates=templates, position=position,
            max_words=max_words, font_size=font_size,
        )

        print("\n==============================")
        print("🎉 PIPELINE COMPLETE")
        print("==============================")
        print(f"📁 Workspace: {result['workspace']}")
        for layout, per_template in result["outputs"].items():
            for template, clip_outputs in per_template.items():
                ok = sum(1 for p in clip_outputs.values() if p)
                print(f"🎬 {layout} / {template}: {ok}/{len(clip_outputs)} clips rendered")
    except Exception as e:
        print("\n==============================")
        print("❌ PROCESSING ERROR")
        print("==============================")
        print("An error occurred during video processing.")
        print(f"Details: {str(e)}")
        print("\nPlease verify your inputs (URL, files) and internet connection, then try again.")


if __name__ == "__main__":
    main()