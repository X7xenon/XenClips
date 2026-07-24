"""
srt_exporter.py – Convert word-level caption data (or existing .ass files) to SRT format.

Pure Python, no external dependencies.
"""

from __future__ import annotations

import re
import os
import sys


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_srt_time(seconds: float) -> str:
    """Convert *seconds* to SRT timestamp format ``HH:MM:SS,mmm``.

    >>> to_srt_time(65.32)
    '00:01:05,320'
    >>> to_srt_time(0)
    '00:00:00,000'
    """
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    # Guard against floating-point rounding pushing millis to 1000
    if millis >= 1000:
        millis = 0
        secs += 1
        if secs >= 60:
            secs = 0
            minutes += 1
            if minutes >= 60:
                minutes = 0
                hours += 1
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


# ---------------------------------------------------------------------------
# Word-level → SRT
# ---------------------------------------------------------------------------

def words_to_srt(words: list[dict], output_path: str, max_words: int = 3) -> str:
    """Group Whisper word-level dicts into chunks and write an SRT file.

    Parameters
    ----------
    words : list[dict]
        Each dict must have ``{"text": str, "start": float, "end": float}``.
    output_path : str
        Destination ``.srt`` file path.
    max_words : int, optional
        Maximum number of words per subtitle entry (default ``3``).

    Returns
    -------
    str
        The *output_path* that was written to.
    """
    if max_words < 1:
        max_words = 1

    # Build chunks of up to *max_words* words
    chunks: list[list[dict]] = []
    for i in range(0, len(words), max_words):
        chunks.append(words[i : i + max_words])

    lines: list[str] = []
    for idx, chunk in enumerate(chunks, start=1):
        start = chunk[0]["start"]
        end = chunk[-1]["end"]
        text = " ".join(w["text"] for w in chunk)
        lines.append(
            f"{idx}\n"
            f"{to_srt_time(start)} --> {to_srt_time(end)}\n"
            f"{text}\n"
        )

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
        # Ensure trailing newline
        if lines:
            fh.write("\n")

    return output_path


# ---------------------------------------------------------------------------
# ASS → SRT
# ---------------------------------------------------------------------------

_ASS_TAG_RE = re.compile(r"\{[^}]*\}")
_ASS_TIME_RE = re.compile(
    r"(\d+):(\d{2}):(\d{2})\.(\d{2})"
)


def _ass_time_to_seconds(ass_ts: str) -> float:
    """Convert an ASS timestamp ``H:MM:SS.cs`` to seconds."""
    m = _ASS_TIME_RE.match(ass_ts)
    if not m:
        raise ValueError(f"Invalid ASS timestamp: {ass_ts!r}")
    h, mm, ss, cs = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return h * 3600 + mm * 60 + ss + cs / 100.0


def ass_to_srt(ass_path: str, output_path: str | None = None) -> str:
    """Parse an ``.ass`` file, strip override tags, and write an ``.srt`` file.

    Parameters
    ----------
    ass_path : str
        Path to the source ``.ass`` file.
    output_path : str | None, optional
        Destination ``.srt`` path.  Defaults to *ass_path* with a ``.srt``
        extension.

    Returns
    -------
    str
        The *output_path* that was written to.
    """
    if output_path is None:
        base, _ = os.path.splitext(ass_path)
        output_path = base + ".srt"

    with open(ass_path, "r", encoding="utf-8-sig") as fh:
        ass_lines = fh.readlines()

    # Extract Dialogue lines ------------------------------------------------
    entries: list[tuple[float, float, str]] = []
    for line in ass_lines:
        line = line.strip()
        if not line.startswith("Dialogue:"):
            continue
        # Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        # We split on ',' but Text itself may contain commas, so limit splits.
        parts = line.split(",", 9)
        if len(parts) < 10:
            continue
        start_ts = parts[1].strip()
        end_ts = parts[2].strip()
        raw_text = parts[9]

        # Strip ASS override tags
        clean_text = _ASS_TAG_RE.sub("", raw_text).strip()
        # Convert \N (ASS hard line-break) to a real newline
        clean_text = clean_text.replace("\\N", "\n").replace("\\n", "\n")

        if not clean_text:
            continue

        try:
            start_sec = _ass_time_to_seconds(start_ts)
            end_sec = _ass_time_to_seconds(end_ts)
        except ValueError:
            continue

        entries.append((start_sec, end_sec, clean_text))

    # Sort by start time (in case the file isn't ordered)
    entries.sort(key=lambda e: e[0])

    # Write SRT --------------------------------------------------------------
    srt_blocks: list[str] = []
    for idx, (start, end, text) in enumerate(entries, start=1):
        srt_blocks.append(
            f"{idx}\n"
            f"{to_srt_time(start)} --> {to_srt_time(end)}\n"
            f"{text}\n"
        )

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(srt_blocks))
        if srt_blocks:
            fh.write("\n")

    return output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python srt_exporter.py <file.ass>  [output.srt]   – convert ASS → SRT")
        print("  python srt_exporter.py --demo                     – run a quick word-level demo")
        sys.exit(0)

    if sys.argv[1] == "--demo":
        demo_words = [
            {"text": "Hello", "start": 0.0, "end": 0.4},
            {"text": "world", "start": 0.5, "end": 0.9},
            {"text": "this", "start": 1.0, "end": 1.3},
            {"text": "is", "start": 1.4, "end": 1.5},
            {"text": "a", "start": 1.6, "end": 1.7},
            {"text": "demo", "start": 1.8, "end": 2.2},
            {"text": "of", "start": 2.3, "end": 2.4},
            {"text": "SRT", "start": 2.5, "end": 2.9},
            {"text": "export", "start": 3.0, "end": 3.5},
        ]
        demo_out = words_to_srt(demo_words, "demo_output.srt", max_words=3)
        print(f"Demo SRT written to: {demo_out}")
        with open(demo_out, "r", encoding="utf-8") as f:
            print(f.read())
    else:
        src = sys.argv[1]
        dst = sys.argv[2] if len(sys.argv) > 2 else None
        result = ass_to_srt(src, dst)
        print(f"SRT written to: {result}")
