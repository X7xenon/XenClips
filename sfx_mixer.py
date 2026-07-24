"""
sfx_mixer.py – Sound FX mixing engine for Shorts Automation v2.

Provides utilities to categorise SFX files by substring matching,
pick random clips per category, and composite them onto a video's
audio track via ffmpeg (-filter_complex adelay + amix).
"""

import os
import random
import subprocess

# ---------------------------------------------------------------------------
# Directory where this script lives – all relative paths resolve from here.
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# SFX category definitions
# Each key is a human-readable category name; its value is a list of
# filename substrings that, if found (case-insensitive) in a file's
# basename, assign that file to the category.
# ---------------------------------------------------------------------------
SFX_CATEGORIES: dict[str, list[str]] = {
    "whoosh": ["whoosh", "run-vine", "switch"],
    "ding": ["notification", "ding", "camera", "tudum"],
    "dramatic_hit": ["cinematic-suspense", "shocking", "vine-boom", "dramatic"],
    "laugh": ["cat-laugh", "eh-eh", "fahh", "yooo"],
    "reaction": ["anime-wow", "wow-kya", "studio-audience", "rizz"],
    "meme": [
        "john-cena", "gta-san", "dexter", "drip-goku",
        "galaxy", "spiderman", "kanchana",
    ],
    "indian": [
        "ab-tu-gaya", "alakh-sir", "baigan", "chaloo",
        "family-dekhte", "jhinka", "le-beta", "modi-ji",
        "shabash", "sybau", "tehelka", "uth-jaa",
        "whoooooo", "i-got-this", "meri-jung", "indian-song",
    ],
    "pop": [
        "maro-jump", "cartoonslip", "slap",
        "mac-quack", "deepbark", "meow",
    ],
    "censor": ["censor-beep", "windows-error"],
    "music": ["the-weeknd", "lights-action", "sad-meow"],
}

# ---------------------------------------------------------------------------
# Per-template default SFX palettes
# ---------------------------------------------------------------------------
TEMPLATE_SFX_DEFAULTS: dict[str, list[str]] = {
    "alex_hormozi": ["dramatic_hit", "whoosh"],
    "mrbeast": ["dramatic_hit", "ding", "whoosh"],
    "iman_gadzhi": ["ding"],
    "podcast": [],
    "gaming": ["meme", "reaction", "pop"],
    "motivational": ["dramatic_hit", "whoosh"],
    "tiktok_viral": ["reaction", "pop", "whoosh"],
    "premium_cinematic": ["dramatic_hit"],
    "minimal_clean": [],
    "ali_abdaal": ["ding"],
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def categorize_sfx_file(filename: str) -> str:
    """Return the SFX category for *filename* via case-insensitive substring
    match against :data:`SFX_CATEGORIES`.  Returns ``"uncategorized"`` if no
    substring matches.

    Parameters
    ----------
    filename:
        A bare filename (or full path – only the basename is inspected).
    """
    basename_lower = os.path.basename(filename).lower()
    for category, substrings in SFX_CATEGORIES.items():
        for sub in substrings:
            if sub.lower() in basename_lower:
                return category
    return "uncategorized"


def get_sfx_for_category(
    category: str,
    sfx_root: str = "Sound effects",
) -> list[str]:
    """Return a list of absolute file paths inside *sfx_root* whose basenames
    match the given *category*.

    Parameters
    ----------
    category:
        One of the keys in :data:`SFX_CATEGORIES`.
    sfx_root:
        Folder name (resolved relative to the script directory) that contains
        the flat collection of SFX files.

    Returns
    -------
    list[str]
        Matching file paths, or an empty list when the category is unknown
        or the folder does not exist.
    """
    if category not in SFX_CATEGORIES:
        return []

    sfx_dir = os.path.join(_SCRIPT_DIR, sfx_root)
    if not os.path.isdir(sfx_dir):
        return []

    substrings = [s.lower() for s in SFX_CATEGORIES[category]]
    matches: list[str] = []
    for entry in os.listdir(sfx_dir):
        entry_lower = entry.lower()
        if any(sub in entry_lower for sub in substrings):
            full_path = os.path.join(sfx_dir, entry)
            if os.path.isfile(full_path):
                matches.append(full_path)
    return matches


# ---------------------------------------------------------------------------
# Core mixing function
# ---------------------------------------------------------------------------

def mix_sfx(
    video_path: str,
    output_path: str,
    sfx_cues: list[dict],
    sfx_root: str = "Sound effects",
    duck_db: float = -12.0,
) -> str:
    """Mix SFX clips onto *video_path*'s audio track and write to *output_path*.

    Parameters
    ----------
    video_path:
        Path to the source video file.
    output_path:
        Destination path for the composited video.
    sfx_cues:
        List of dicts ``{"time_offset": float, "type": str}`` describing when
        (in seconds) and which category of SFX to overlay.
    sfx_root:
        SFX folder name, resolved relative to the script directory.
    duck_db:
        Volume adjustment in dB applied to each SFX clip (negative values
        lower the SFX volume relative to the main audio).

    Returns
    -------
    str
        *output_path* on success.

    Raises
    ------
    RuntimeError
        If *video_path* does not exist or ffmpeg exits with a non-zero code.
    """
    # --- Validate inputs ------------------------------------------------- #
    if not os.path.isfile(video_path):
        raise RuntimeError(f"Video file not found: {video_path}")

    if not sfx_cues:
        # Nothing to mix – just copy the original file.
        _copy_file(video_path, output_path)
        return output_path

    # --- Resolve one random SFX file per cue ----------------------------- #
    resolved_cues: list[tuple[float, str]] = []  # (offset_sec, sfx_path)
    for cue in sfx_cues:
        offset = float(cue.get("time_offset", 0))
        category = cue.get("type", "")
        candidates = get_sfx_for_category(category, sfx_root)
        if not candidates:
            continue  # skip silently
        resolved_cues.append((offset, random.choice(candidates)))

    if not resolved_cues:
        # Every cue was skipped – just copy the source.
        _copy_file(video_path, output_path)
        return output_path

    # --- Build ffmpeg command -------------------------------------------- #
    # Convert duck_db to ffmpeg volume filter value (e.g. "volume=-12dB")
    duck_volume = f"volume={duck_db}dB"

    # Input arguments: -i video -i sfx1 -i sfx2 ...
    input_args: list[str] = ["-y", "-i", video_path]
    for _, sfx_path in resolved_cues:
        input_args.extend(["-i", sfx_path])

    # filter_complex parts
    filter_parts: list[str] = []
    mix_labels: list[str] = []
    for idx, (offset_sec, _) in enumerate(resolved_cues, start=1):
        delay_ms = int(offset_sec * 1000)
        label = f"s{idx}"
        filter_parts.append(
            f"[{idx}]adelay={delay_ms}|{delay_ms},{duck_volume}[{label}]"
        )
        mix_labels.append(f"[{label}]")

    n_inputs = len(resolved_cues) + 1  # original audio + SFX streams
    mix_src = "[0:a]" + "".join(mix_labels)
    filter_parts.append(
        f"{mix_src}amix=inputs={n_inputs}:duration=first:dropout_transition=2[aout]"
    )
    filter_complex = ";".join(filter_parts)

    cmd: list[str] = [
        "ffmpeg",
        *input_args,
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        output_path,
    ]

    # --- Execute --------------------------------------------------------- #
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError:
        raise RuntimeError(
            "ffmpeg not found. Please ensure ffmpeg is installed and on PATH."
        )

    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg exited with code {result.returncode}.\n"
            f"stderr:\n{result.stderr}"
        )

    return output_path


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _copy_file(src: str, dst: str) -> None:
    """Byte-copy *src* to *dst*, creating parent directories if needed."""
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(src, "rb") as f_in, open(dst, "wb") as f_out:
        while chunk := f_in.read(1 << 20):  # 1 MiB chunks
            f_out.write(chunk)
