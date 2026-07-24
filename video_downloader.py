import os
import shutil
import subprocess

from utils import clean_filename, create_workspace

YT_DLP = r"X:\Softwares\Python\Scripts\yt-dlp.exe"
COOKIES = "cookies.txt"

TEMP_DIR = os.path.join("downloads", "_temp")


def get_youtube_title(url):
    cmd = [YT_DLP, "--print", "title", url]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return result.stdout.strip()


import json
import re

def get_video_id(url: str) -> str:
    patterns = [r"v=([^&]+)", r"youtu\.be/([^?&]+)", r"youtube\.com/shorts/([^?&]+)"]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_cached_title(url: str) -> str:
    vid = get_video_id(url)
    if not vid: return None
    cache_file = os.path.join("downloads", "url_cache.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f).get(vid)
        except Exception:
            pass
    return None

def save_title_to_cache(url: str, title: str):
    vid = get_video_id(url)
    if not vid: return
    cache_file = os.path.join("downloads", "url_cache.json")
    os.makedirs("downloads", exist_ok=True)
    cache_data = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cache_data = json.load(f)
        except Exception:
            pass
    cache_data[vid] = title
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(cache_data, f)
    except Exception:
        pass

def download_video(url):
    if os.path.isfile(url):
        # Local file path! Bypasses yt-dlp downloading.
        title = clean_filename(os.path.splitext(os.path.basename(url))[0])
        folders = create_workspace(title)
        final_video = os.path.join(folders["input"], f"{title}.mp4")
        if not os.path.exists(final_video) or os.path.abspath(url) != os.path.abspath(final_video):
            shutil.copy2(url, final_video)
        return {
            "title": title,
            "workspace": folders["workspace"],
            "video_path": final_video,
        }

    # For YouTube URLs, check if we already downloaded it
    try:
        cached_title = get_cached_title(url)
        if cached_title:
            title = clean_filename(cached_title)
            folders = create_workspace(title)
            final_video = os.path.join(folders["input"], f"{title}.mp4")
            if os.path.exists(final_video):
                return {
                    "title": title,
                    "workspace": folders["workspace"],
                    "video_path": final_video,
                }
        
        # If not cached, fetch title
        raw_title = get_youtube_title(url)
        save_title_to_cache(url, raw_title)
        title = clean_filename(raw_title)
        folders = create_workspace(title)
        final_video = os.path.join(folders["input"], f"{title}.mp4")
        if os.path.exists(final_video):
            return {
                "title": title,
                "workspace": folders["workspace"],
                "video_path": final_video,
            }
    except Exception as e:
        print(f"Failed to fetch title for caching check: {e}")

    os.makedirs(TEMP_DIR, exist_ok=True)

    # Remove old temp files
    for f in os.listdir(TEMP_DIR):
        try:
            os.remove(os.path.join(TEMP_DIR, f))
        except Exception:
            pass

    output_template = os.path.join(
        TEMP_DIR,
        "%(title)s.%(ext)s"
    )

    cmd = [
        YT_DLP,
        "--remote-components", "ejs:github",
        "--cookies", COOKIES,
        "-f", "bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "--newline",
        "-o", output_template,
        url,
    ]

    # Use exactly the same environment as the shell
    subprocess.run(cmd, check=True, shell=True)

    # Find downloaded video
    video_path = None

    for file in os.listdir(TEMP_DIR):
        if file.lower().endswith((".mp4", ".mkv", ".webm")):
            video_path = os.path.join(TEMP_DIR, file)
            break

    if video_path is None:
        raise FileNotFoundError("Download failed.")

    title = clean_filename(os.path.splitext(os.path.basename(video_path))[0])

    folders = create_workspace(title)

    final_video = os.path.join(
    folders["input"],
    f"{title}.mp4"
)

    shutil.move(video_path, final_video)

    return {
        "title": title,
        "workspace": folders["workspace"],
        "video_path": final_video,
    }


if __name__ == "__main__":
    result = download_video(input("URL: ").strip())
    print(result)