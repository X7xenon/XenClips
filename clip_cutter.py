import os
import json
import shutil
import subprocess


# =========================
# LOAD CLIPS.JSON
# =========================

def load_clips(clips_json_path):
    with open(clips_json_path, "r", encoding="utf-8") as f:
        return json.load(f)


# =========================
# CUT ONE RAW CLIP (fast, no re-encode)
# =========================

def cut_raw_clip(video_path, start, end, output_path):
    duration = float(end) - float(start)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-i", video_path,
        "-t", str(duration),
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Raw cut failed for {output_path}:\n{result.stderr[-2000:]}")
    return output_path


# =========================
# CUT ALL RAW CLIPS FROM clips.json -> workspace/temp/raw_N.mp4
# =========================

def cut_all_raw_clips(video_path, clips_json_path, workspace):
    """
    Cuts every clip from clips.json into workspace/temp/raw_{n}.mp4 using
    fast stream-copy (no re-encode, no layout, no captions — those get
    applied in a later step once a template is picked).

    Returns a list of dicts: [{"clip_number", "raw_path", "start", "end",
    "hook_text", "emoji", ...(rest of the clip's original fields)}, ...]
    """
    data = load_clips(clips_json_path)
    clips = data.get("clips", [])

    if not clips:
        raise ValueError("No clips found in JSON")

    temp_dir = os.path.join(workspace, "temp")
    os.makedirs(temp_dir, exist_ok=True)

    print("\n==============================")
    print("Cutting Raw Clips (fast copy, no encode)")
    print("==============================\n")

    results = []
    for i, clip in enumerate(clips, start=1):
        start = float(clip["start"])
        end = float(clip["end"])
        raw_path = os.path.join(temp_dir, f"raw_{i}.mp4")

        print(f"✂  Raw clip {i}: {start:.2f}s → {end:.2f}s")

        try:
            cut_raw_clip(video_path, start, end, raw_path)
            print(f"   ✅ Saved → {raw_path}")
            entry = dict(clip)  # keep hook_text/emoji/reaction_moment/etc from Gemini output
            entry["clip_number"] = i
            entry["raw_path"] = raw_path
            results.append(entry)
        except Exception as e:
            print(f"   ❌ Failed raw clip {i}: {e}")
            entry = dict(clip)
            entry["clip_number"] = i
            entry["raw_path"] = None
            results.append(entry)

        print()

    print("==============================")
    print(f"Raw Clips Done: {sum(1 for r in results if r['raw_path'])}/{len(clips)}")
    print("==============================\n")

    return results


# =========================
# CLEANUP — delete input/ and temp/ entirely after final clips are rendered
# =========================

def cleanup_workspace(workspace, delete_input=True, delete_temp=True):
    """
    Removes the downloaded source video (input/) and raw intermediate clips
    (temp/) once final rendering is done, to save disk space. Only call this
    AFTER the final templated clips are safely written to clips/ — this is
    irreversible.
    """
    removed = []

    if delete_input:
        input_dir = os.path.join(workspace, "input")
        if os.path.exists(input_dir):
            shutil.rmtree(input_dir, ignore_errors=True)
            removed.append(input_dir)

    if delete_temp:
        temp_dir = os.path.join(workspace, "temp")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            removed.append(temp_dir)

    for path in removed:
        print(f"🗑  Deleted: {path}")

    return removed


# =========================
# CLI
# =========================
if __name__ == "__main__":
    video_path = input("Enter source video path: ").strip()
    clips_json_path = input("Enter clips.json path: ").strip()
    workspace = input("Enter workspace folder (e.g. downloads/Video Title): ").strip()

    cut_all_raw_clips(video_path, clips_json_path, workspace)