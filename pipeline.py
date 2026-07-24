"""
pipeline.py — orchestrates the FULL new pipeline:

    download_video
        -> transcript.save_transcript        (YouTube captions — used ONLY to
                                               find viral moments, not for captions)
        -> viral_clip_selector.generate_viral_clips  (Gemini)
        -> clip_cutter.cut_all_raw_clips      (fast -c copy cut, raw clips into temp/)
        -> whisper_transcriber.transcribe_clips_batch  (REAL word-level captions,
                                               per already-cut clip)
        -> hinglish_corrector.correct_clips_batch      (fixes Hinglish spelling,
                                               only if a clip is detected as Hinglish)
        -> generate_ass.build_ass_from_whisper_words   (once per clip per template)
        -> clip_editor.process_raw_clips_multi_template (layout crop + caption burn)
        -> clip_cutter.cleanup_workspace       (delete input/ and temp/ to save space)

This replaces the old flow (YouTube-transcript word-interpolation via
generate_ass.generate_all_ass + clip_editor.process_clips_multi_template),
which is left in place for reference but no longer called from here.
"""

from __future__ import annotations

import os

from video_downloader import download_video
from transcript import save_transcript
from viral_clip_selector import generate_viral_clips, save_clips
from clip_cutter import cut_all_raw_clips, cleanup_workspace
from whisper_transcriber import transcribe_clips_batch
from hinglish_corrector import correct_clips_batch
from generate_ass import build_ass_from_whisper_words
from clip_editor import process_raw_clips_multi_layout_template
from sfx_engine.generator import generate_events
from sfx_engine.mapper import map_events_to_audio
from watermark import apply_watermark

MIN_TEMPLATES = 1
MIN_LAYOUTS = 1


def run_pipeline(
    url: str,
    layouts: list[str] | None = None,
    templates: list[str] | None = None,
    position: str = "bottom",
    max_words: int | None = None,   # caption words-per-line override (all templates)
    font_size: int | None = None,   # caption font-size override (all templates)
    target_duration: int | None = None, # target clip length override
    num_clips: int = 6, # number of clips to generate
    generate_captions: bool = True,
    sfx_enabled: bool = True,
    sfx_volume: int = 100,
    sfx_pack: str = "default",
    watermark_options: dict | None = None,
    do_cleanup: bool = True,
    progress_cb=None,  # optional callable(step: str, progress: int) — for server.py status polling
) -> dict:
    """
    Runs the full pipeline end-to-end. Returns a dict:
        {
            "video_title": str,
            "workspace": str,
            "clips": [{"clip_number", "hook_text", "emoji", "reaction_moment", ...}, ...],
            "outputs": {layout: {template: {clip_number: output_path_or_None}}},
            "ass_path_map": {template: {clip_number: ass_path}},
        }
    """
    layouts = layouts or ["full_vertical"]
    templates = templates or ["alex_hormozi", "mrbeast", "podcast"]
    layouts = list(dict.fromkeys(layouts))     # de-dupe, preserve order
    templates = list(dict.fromkeys(templates)) if generate_captions else ["none"]

    if len(layouts) < MIN_LAYOUTS:
        raise ValueError(f"Provide at least {MIN_LAYOUTS} layout")
    if generate_captions and len(templates) < MIN_TEMPLATES:
        raise ValueError(f"Provide at least {MIN_TEMPLATES} distinct templates")

    def _status(step, pct):
        print(f"[pipeline] {step} ({pct}%)")
        if progress_cb:
            progress_cb(step, pct)

    # --------------------------
    # STEP 1: DOWNLOAD
    # --------------------------
    _status("Fetching Video (Checking cache...)", 5)
    result = download_video(url)
    video_path = result["video_path"]
    video_title = result["title"]
    workspace = result["workspace"]

    # --------------------------
    # STEP 2: TRANSCRIPT (for Gemini viral-moment detection only)
    # --------------------------
    transcript_path = os.path.join(workspace, "transcript", "transcript.json")
    if os.path.exists(transcript_path):
        _status("Transcript already exists (skipping generation)", 15)
    else:
        _status("Generating Transcript (for viral detection)", 15)
        transcript_path = save_transcript(url, video_title)

    # --------------------------
    # STEP 3: GEMINI VIRAL MOMENTS
    # --------------------------
    clips_json_path = os.path.join(workspace, "clips", "clips.json")
    if os.path.exists(clips_json_path):
        _status("Viral moments already exist (skipping Gemini)", 15)
        import json
        with open(clips_json_path, "r", encoding="utf-8") as f:
            clips = json.load(f)["clips"]
    else:
        _status("Finding Viral Moments...", 15)
        clips = generate_viral_clips(transcript_path, target_duration=target_duration, num_clips=num_clips)
        clips_json_path = save_clips(clips, workspace)

    # --------------------------
    # STEP 4: RAW CUT (fast, no captions/layout yet)
    # --------------------------
    _status("Cutting Raw Clips", 35)
    raw_clip_records = cut_all_raw_clips(video_path, clips_json_path, workspace)

    valid_records = [r for r in raw_clip_records if r.get("raw_path")]
    if not valid_records:
        raise RuntimeError("No raw clips were successfully cut — check clip_cutter output above")



    # --------------------------
    # STEP 5: WHISPER TRANSCRIPTION (real word-level, per clip)
    # --------------------------
    words_by_clip_number = {}
    if generate_captions:
        _status("Transcribing Clips (Whisper)", 45)
        raw_paths = [r["raw_path"] for r in valid_records]
        words_by_path = transcribe_clips_batch(raw_paths)  # {raw_path: [words...]}

        # --------------------------
        # STEP 6: HINGLISH CORRECTION (only where detected as Hinglish)
        # --------------------------
        _status("Correcting Hinglish Captions", 55)
        corrected_by_path = correct_clips_batch(words_by_path)  # {raw_path: [words...]}

        words_by_clip_number = {
            r["clip_number"]: corrected_by_path.get(r["raw_path"], [])
            for r in valid_records
        }
    else:
        words_by_clip_number = {r["clip_number"]: [] for r in valid_records}

    # --------------------------
    # STEP 6.5: GENERATE SFX CUES (NEW)
    # --------------------------
    if sfx_enabled:
        _status("Generating SFX Cues", 60)
        # We use the first template as the base for animation hints
        base_template = templates[0] if templates else "alex_hormozi"
        for r in valid_records:
            words = words_by_clip_number.get(r["clip_number"], [])
            events = generate_events(words, template=base_template)
            mapped_cues = map_events_to_audio(events, pack=sfx_pack)
            r["sfx_cues"] = mapped_cues
    else:
        for r in valid_records:
            r["sfx_cues"] = []

    # --------------------------
    # STEP 7: GENERATE ASS PER CLIP PER TEMPLATE (layout-independent)
    # --------------------------
    clips_dir = os.path.join(workspace, "clips")
    os.makedirs(clips_dir, exist_ok=True)
    ass_path_map = {}  # {template: {clip_number: ass_path}}

    if generate_captions:
        _status("Generating Subtitles", 65)
        for template in templates:
            ass_path_map[template] = {}
            for clip_number, words in words_by_clip_number.items():
                ass_path = os.path.join(clips_dir, f"clip_{clip_number}__{template}.ass")
                build_ass_from_whisper_words(
                    words, ass_path, template=template, position=position,
                    max_words=max_words, font_size=font_size,
                )
                ass_path_map[template][clip_number] = ass_path

        # Save raw words JSON for editing/previewing on the web
        for clip_number, words in words_by_clip_number.items():
            words_json_path = os.path.join(clips_dir, f"clip_{clip_number}__words.json")
            try:
                import json
                with open(words_json_path, "w", encoding="utf-8") as f:
                    json.dump(words, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"Warning: could not save words JSON for clip {clip_number}: {e}")
    else:
        ass_path_map["none"] = {clip_number: None for clip_number in words_by_clip_number.keys()}

    # --------------------------
    # STEP 8: RENDER (layout crop + caption burn, per clip per layout per template)
    # --------------------------
    any_yolo_layout = any(l in ("full_vertical", "ishowspeed") for l in layouts)
    _status(
        "Rendering Clips (smart crop — slow on CPU)" if any_yolo_layout else "Rendering Clips",
        80,
    )
    outputs = process_raw_clips_multi_layout_template(
        raw_clip_records=valid_records,
        output_dir=clips_dir,
        ass_path_map=ass_path_map,
        templates=templates,
        layouts=layouts,
        position=position,
        sfx_volume=sfx_volume if sfx_enabled else 0,
    )

    # --------------------------
    # STEP 8.5: WATERMARK
    # --------------------------
    if watermark_options and watermark_options.get("enabled"):
        _status("Applying Watermark", 90)
        import tempfile
        import shutil
        for layout, layout_dict in outputs.items():
            for template, template_dict in layout_dict.items():
                for clip_id, clip_path in template_dict.items():
                    if clip_path and os.path.exists(clip_path):
                        temp_out = clip_path + ".wm.mp4"
                        success = apply_watermark(clip_path, temp_out, watermark_options)
                        if success and os.path.exists(temp_out):
                            shutil.move(temp_out, clip_path)

    # --------------------------
    # STEP 9: CLEANUP (delete input/ and temp/ to save disk space)
    # --------------------------
    if do_cleanup:
        _status("Cleaning Up", 95)
        cleanup_workspace(workspace)

    _status("Done", 100)

    return {
        "video_title": video_title,
        "workspace": workspace,
        "clips": valid_records,
        "outputs": outputs,
        "ass_path_map": ass_path_map,
    }


if __name__ == "__main__":
    url = input("Enter YouTube URL:\n\n").strip()
    result = run_pipeline(url)
    print("\n🎉 DONE")
    print(f"Workspace: {result['workspace']}")
    for layout, per_template in result["outputs"].items():
        for template, clip_outputs in per_template.items():
            ok = sum(1 for p in clip_outputs.values() if p)
            print(f"  {layout} / {template}: {ok}/{len(clip_outputs)} rendered")