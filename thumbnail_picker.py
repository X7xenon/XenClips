"""
thumbnail_picker.py
====================
Auto-selects the best thumbnail frame from a video clip by scoring
sampled frames on face prominence and sharpness.
"""

import os
import sys

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Haar cascade for face detection (ships with opencv-python)
# ---------------------------------------------------------------------------
_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _face_score(gray: np.ndarray, frame_area: int) -> float:
    """Return normalised face-coverage score (0..~1)."""
    faces = _FACE_CASCADE.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
    )
    if len(faces) == 0:
        return 0.0
    total_face_area = sum(int(w) * int(h) for (_, _, w, h) in faces)
    return total_face_area / frame_area


def _sharpness_score(gray: np.ndarray) -> float:
    """Return Laplacian-variance sharpness score clamped to [0, 1]."""
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return min(variance / 1000.0, 1.0)


def _combined_score(face: float, sharpness: float) -> float:
    """Weighted combination — faces matter more."""
    return face * 2.0 + sharpness * 0.5


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def pick_best_thumbnail(
    video_path: str,
    output_dir: str | None = None,
    n_samples: int = 10,
) -> str | None:
    """Sample *n_samples* evenly-spaced frames, score them, and save the
    best one as ``{video_basename}_thumb.jpg``.

    Parameters
    ----------
    video_path : str
        Path to the source video file.
    output_dir : str | None
        Directory to write the thumbnail into.  Defaults to the same
        directory as *video_path*.
    n_samples : int
        Number of frames to evaluate (default 10).

    Returns
    -------
    str | None
        Absolute path of the saved thumbnail, or ``None`` if the video
        could not be opened.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return None

    # Determine which frame indices to sample
    n_samples = min(n_samples, total_frames)
    indices = np.linspace(0, total_frames - 1, n_samples, dtype=int)

    best_frame = None
    best_score = -1.0

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if not ret or frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        frame_h, frame_w = frame.shape[:2]
        frame_area = frame_w * frame_h

        f_score = _face_score(gray, frame_area)
        s_score = _sharpness_score(gray)
        score = _combined_score(f_score, s_score)

        if score > best_score:
            best_score = score
            best_frame = frame.copy()

    cap.release()

    if best_frame is None:
        return None

    # Build output path
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(video_path))
    os.makedirs(output_dir, exist_ok=True)

    base = os.path.splitext(os.path.basename(video_path))[0]
    thumb_path = os.path.join(output_dir, f"{base}_thumb.jpg")
    cv2.imwrite(thumb_path, best_frame)

    return thumb_path


def pick_thumbnails_batch(
    video_paths: list[str],
    output_dir: str | None = None,
) -> dict[str, str | None]:
    """Run :func:`pick_best_thumbnail` for every video in *video_paths*.

    Returns
    -------
    dict[str, str | None]
        Mapping of ``{video_path: thumbnail_path_or_None}``.
    """
    results: dict[str, str | None] = {}
    for vp in video_paths:
        results[vp] = pick_best_thumbnail(vp, output_dir=output_dir)
    return results


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python thumbnail_picker.py <video> [video …]")
        sys.exit(1)

    videos = sys.argv[1:]
    results = pick_thumbnails_batch(videos)

    for video, thumb in results.items():
        if thumb:
            print(f"[OK]   {video}  ->  {thumb}")
        else:
            print(f"[FAIL] {video}  (could not process)")
