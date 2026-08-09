"""
emotional_peaks.py
──────────────────
Detect emotional peak moments in video clips via audio loudness analysis.

Uses ffmpeg's astats filter to extract per-second RMS levels, then flags
spikes that exceed a configurable threshold above the mean.  Results can
be merged with Gemini emotion scores and SFX cue timestamps to produce a
unified list of "zoom-on-emotion" trigger points.

Dependencies: subprocess, re, os  (no pip installs required)
"""

from __future__ import annotations

import math
import os
import re
import subprocess
import sys
from typing import Optional


# ────────────────────────────────────────────────────────────────────
# 1.  Audio-peak detection via ffmpeg
# ────────────────────────────────────────────────────────────────────

def detect_audio_peaks(
    video_path: str,
    window_sec: float = 1.0,
    spike_threshold: float = 1.5,
) -> list[dict]:
    """Extract per-second RMS loudness from *video_path* and return peaks.

    Parameters
    ----------
    video_path : str
        Path to a video (or audio) file readable by ffmpeg.
    window_sec : float
        Analysis window length in seconds (ffmpeg ``reset`` value).
    spike_threshold : float
        A window is flagged as a peak when its RMS exceeds
        ``mean + spike_threshold * std`` of all finite RMS values.

    Returns
    -------
    list[dict]
        ``[{"time": float, "rms": float, "intensity": float}, ...]``
        *intensity* is normalised 0.0 – 1.0 based on how far above the
        threshold the peak is.  Empty list on error or silent audio.
    """
    if not os.path.isfile(video_path):
        return []

    # Build the ffmpeg command with the requested reset window.
    reset_val = max(1, int(round(window_sec)))
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-af",
        f"astats=metadata=1:reset={reset_val},ametadata=print:key=lavfi.astats.Overall.RMS_level",
        "-f", "null",
        "-",
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=300,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return []

    stderr = result.stderr
    if not stderr:
        return []

    # ------------------------------------------------------------------
    # Parse stderr – we need two things per measurement:
    #   1. The timestamp from a "pts_time:T.TTT" token.
    #   2. The RMS value from "lavfi.astats.Overall.RMS_level=VALUE".
    #
    # ffmpeg interleaves frame-info lines and metadata lines:
    #   frame:0    pts:0       pts_time:0.000000
    #   lavfi.astats.Overall.RMS_level=-20.123456
    #
    # We track the most-recent pts_time and pair it with the next RMS
    # value we encounter.
    # ------------------------------------------------------------------

    # Regex for the timestamp token (may appear among other tokens)
    re_pts_time = re.compile(r"pts_time\s*[:=]\s*([\d.]+)")
    # Regex for the RMS metadata value
    re_rms = re.compile(
        r"lavfi\.astats\.Overall\.RMS_level\s*=\s*(-?[\d.]+(?:e[+-]?\d+)?|-inf)",
        re.IGNORECASE,
    )

    current_time: Optional[float] = None
    raw_points: list[tuple[float, float]] = []  # (time, rms_db)

    for line in stderr.splitlines():
        # Look for pts_time anywhere on the line
        m_pts = re_pts_time.search(line)
        if m_pts:
            try:
                current_time = float(m_pts.group(1))
            except ValueError:
                pass

        # Look for an RMS value
        m_rms = re_rms.search(line)
        if m_rms:
            val_str = m_rms.group(1).strip().lower()
            if val_str == "-inf":
                # Silence – skip
                continue
            try:
                rms_val = float(val_str)
            except ValueError:
                continue

            ts = current_time if current_time is not None else 0.0
            raw_points.append((ts, rms_val))

    if not raw_points:
        return []

    # ------------------------------------------------------------------
    # Statistics on finite RMS values (in dB scale)
    # ------------------------------------------------------------------
    rms_values = [r for _, r in raw_points]
    n = len(rms_values)
    if n == 0:
        return []

    mean_rms = sum(rms_values) / n
    variance = sum((v - mean_rms) ** 2 for v in rms_values) / n
    std_rms = math.sqrt(variance) if variance > 0 else 0.0

    threshold_line = mean_rms + spike_threshold * std_rms

    # If std is zero every value is identical – nothing is a "peak"
    if std_rms == 0.0:
        return []

    # ------------------------------------------------------------------
    # Flag peaks & compute intensity
    # ------------------------------------------------------------------
    peaks: list[dict] = []
    # For intensity normalisation, find the max RMS so we can scale 0-1
    max_rms = max(rms_values)
    intensity_range = max_rms - threshold_line  # how far above threshold is possible

    for ts, rms in raw_points:
        if rms > threshold_line:
            if intensity_range > 0:
                intensity = min(1.0, max(0.0, (rms - threshold_line) / intensity_range))
            else:
                intensity = 1.0
            peaks.append({
                "time": round(ts, 3),
                "rms": round(rms, 4),
                "intensity": round(intensity, 4),
            })

    return peaks


# ────────────────────────────────────────────────────────────────────
# 2.  Multi-source peak merging
# ────────────────────────────────────────────────────────────────────

def merge_peaks(
    audio_peaks: list[dict],
    gemini_emotion: float = 0.0,
    min_gap_sec: float = 2.0,
) -> list[dict]:
    """Merge audio peaks and Gemini emotion score.

    Parameters
    ----------
    audio_peaks : list[dict]
        Output of :func:`detect_audio_peaks`.
    gemini_emotion : float
        Gemini's overall emotion_intensity for the clip (0-1).  Applied as
        a flat boost to every audio peak's intensity.
    min_gap_sec : float
        Minimum seconds between retained peaks.  When two peaks are
        closer than this, the one with higher intensity wins.

    Returns
    -------
    list[dict]
        ``[{"time": float, "intensity": float, "source": str}, ...]``
        Sorted by time, deduplicated.
    """
    combined: list[dict] = []

    # Audio peaks
    for p in audio_peaks:
        boosted = min(1.0, p.get("intensity", 0.0) + gemini_emotion * 0.3)
        combined.append({
            "time": p["time"],
            "intensity": round(boosted, 4),
            "source": "audio",
        })

    if not combined:
        return []

    # Sort by time
    combined.sort(key=lambda p: p["time"])

    # ------------------------------------------------------------------
    # Deduplicate: walk through sorted list, keep highest intensity in
    # each min_gap_sec window.
    # ------------------------------------------------------------------
    merged: list[dict] = [combined[0]]
    for peak in combined[1:]:
        prev = merged[-1]
        if peak["time"] - prev["time"] < min_gap_sec:
            # Keep whichever has higher intensity
            if peak["intensity"] > prev["intensity"]:
                merged[-1] = peak
        else:
            merged.append(peak)

    return merged


# ────────────────────────────────────────────────────────────────────
# 3.  Zoom-trigger extraction
# ────────────────────────────────────────────────────────────────────

def get_zoom_timestamps(
    peaks: list[dict],
    threshold: float = 0.5,
) -> list[dict]:
    """Return timestamps where zoom-on-emotion should trigger.

    Parameters
    ----------
    peaks : list[dict]
        Output of :func:`merge_peaks` (or :func:`detect_audio_peaks`).
    threshold : float
        Minimum intensity to qualify for a zoom.

    Returns
    -------
    list[dict]
        ``[{"time": float, "intensity": float}, ...]``
    """
    return [
        {"time": p["time"], "intensity": p["intensity"]}
        for p in peaks
        if p.get("intensity", 0.0) >= threshold
    ]


# ────────────────────────────────────────────────────────────────────
# CLI entry-point
# ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python emotional_peaks.py <video_path> [spike_threshold]")
        sys.exit(1)

    video = sys.argv[1]
    thresh = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5

    print(f"[emotional_peaks] Analysing: {video}")
    print(f"[emotional_peaks] Spike threshold: {thresh}\n")

    peaks = detect_audio_peaks(video, spike_threshold=thresh)

    if not peaks:
        print("  No audio peaks detected (silent / no audio / ffmpeg error).")
        sys.exit(0)

    print(f"  Detected {len(peaks)} audio peak(s):\n")
    print(f"  {'Time (s)':>10}  {'RMS (dB)':>10}  {'Intensity':>10}")
    print(f"  {'--------':>10}  {'--------':>10}  {'---------':>10}")
    for p in peaks:
        print(f"  {p['time']:10.3f}  {p['rms']:10.4f}  {p['intensity']:10.4f}")

    # Demo merge (no Gemini / SFX data in CLI mode)
    merged = merge_peaks(peaks)
    zoom = get_zoom_timestamps(merged, threshold=0.5)

    print(f"\n  Zoom-trigger timestamps (intensity >= 0.5): {len(zoom)}")
    for z in zoom:
        print(f"    t={z['time']:.3f}s  intensity={z['intensity']:.4f}")
