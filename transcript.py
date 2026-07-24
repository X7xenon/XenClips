import re
import os
from yt_dlp import YoutubeDL
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    NoTranscriptFound,
)

from utils import create_workspace, clean_filename
import json

def get_video_id(url: str) -> str:
    """
    Extract YouTube video ID from URL.
    """

    patterns = [
        r"v=([^&]+)",
        r"youtu\.be/([^?&]+)",
        r"youtube\.com/shorts/([^?&]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Invalid YouTube URL")


def get_best_transcript(video_id: str):
    """
    Get the best available transcript.
    Priority:
    1. Manual English
    2. Auto English
    3. Any Manual
    4. Any Auto
    """

    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    try:
        return transcript_list.find_transcript(["en"]).fetch()
    except NoTranscriptFound:
        pass

    try:
        return transcript_list.find_generated_transcript(["en"]).fetch()
    except NoTranscriptFound:
        pass

    for transcript in transcript_list:
        if not transcript.is_generated:
            return transcript.fetch()

    for transcript in transcript_list:
        return transcript.fetch()

    raise NoTranscriptFound(video_id, [], None)


def save_transcript(url: str, video_title: str) -> str:
    """
    Download transcript and save it as JSON with timestamps.

    Returns transcript JSON path.
    """

    video_title = clean_filename(video_title)

    folders = create_workspace(video_title)

    transcript_path = (
        folders["transcript"]
        + "/transcript.json"
    )

    if os.path.isfile(url):
        # Local file path! Use Whisper to transcribe instead of YouTube API.
        from whisper_transcriber import get_whisper_model
        model = get_whisper_model()
        segments, info = model.transcribe(
            url,
            beam_size=3,
            temperature=0.0,
            vad_filter=True,
        )
        
        transcript_data = []
        for segment in segments:
            transcript_data.append({
                "text": segment.text.strip(),
                "start": round(float(segment.start), 2),
                "duration": round(float(segment.end - segment.start), 2),
                "end": round(float(segment.end), 2)
            })
            
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=4, ensure_ascii=False)
            
        print("\n==============================")
        print("Transcript Saved (via Whisper)")
        print("==============================")
        print(transcript_path)
        return transcript_path

    video_id = get_video_id(url)

    transcript = get_best_transcript(video_id)

    transcript_data = []

    for line in transcript:

        transcript_data.append(
            {
                "text": line.text.strip(),
                "start": round(float(line.start), 2),
                "duration": round(float(line.duration), 2),
                "end": round(
                    float(line.start) + float(line.duration),
                    2,
                ),
            }
        )

    with open(
        transcript_path,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            transcript_data,
            f,
            indent=4,
            ensure_ascii=False,
        )

    print("\n==============================")
    print("Transcript Saved")
    print("==============================")
    print(transcript_path)

    return transcript_path


if __name__ == "__main__":

    url = input("Enter YouTube URL: ").strip()

    with YoutubeDL(
        {
            "quiet": True,
            "skip_download": True,
        }
    ) as ydl:

        info = ydl.extract_info(
            url,
            download=False,
        )

    title = clean_filename(info["title"])

    save_transcript(
        url,
        title,
    )