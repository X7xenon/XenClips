import os
import subprocess

def mix_sfx(
    video_path: str,
    output_path: str,
    sfx_cues: list[dict],
    sfx_volume: int = 100
) -> str:
    """Mix SFX clips onto *video_path*'s audio track and write to *output_path*.
    Applies audio ducking (sidechaincompress) and normalization.

    Parameters
    ----------
    video_path:
        Path to the source video file.
    output_path:
        Destination path for the composited video.
    sfx_cues:
        List of dicts containing 'time_offset' (float) and 'path' (str)
    sfx_volume:
        Master volume for SFX (0-100). Default is 100.
    """
    if not os.path.isfile(video_path):
        raise RuntimeError(f"Video file not found: {video_path}")

    # Ensure we only process valid cues with a path
    valid_cues = [c for c in sfx_cues if "path" in c and os.path.isfile(c["path"])]

    if not valid_cues or sfx_volume == 0:
        _copy_file(video_path, output_path)
        return output_path

    # --- Build ffmpeg command -------------------------------------------- #
    # Input arguments: -i video -i sfx1 -i sfx2 ...
    input_args: list[str] = ["-y", "-i", video_path]
    for cue in valid_cues:
        input_args.extend(["-i", cue["path"]])

    # We apply loudnorm to each SFX individually, plus afade, adelay, and volume adjustment.
    # Base volume adjustment relative to 100%. 100 -> 0dB, 50 -> -6dB, etc.
    # A simple formula: if vol=100, mult=1.0. vol=50, mult=0.5.
    volume_mult = max(0.0, sfx_volume / 100.0)
    
    filter_parts: list[str] = []
    mix_labels: list[str] = []
    
    for idx, cue in enumerate(valid_cues, start=1):
        offset_sec = float(cue.get("time_offset", 0))
        delay_ms = int(offset_sec * 1000)
        label = f"s{idx}"
        
        # 1. Fade in the first 50ms to prevent popping
        # 2. Loudnorm to standard -16 LUFS
        # 3. Apply user volume multiplier
        # 4. Delay by offset
        filter_parts.append(
            f"[{idx}:a]afade=t=in:ss=0:d=0.05,loudnorm=I=-16:TP=-1.5:LRA=11,"
            f"volume={volume_mult},adelay={delay_ms}|{delay_ms}[{label}]"
        )
        mix_labels.append(f"[{label}]")

    # Combine all SFX streams into one track 'sfx_mix'
    n_sfx = len(valid_cues)
    if n_sfx > 1:
        sfx_mix_src = "".join(mix_labels)
        filter_parts.append(f"{sfx_mix_src}amix=inputs={n_sfx}:duration=first:dropout_transition=2[sfx_mix]")
    else:
        # Just rename the label to sfx_mix
        filter_parts.append(f"{mix_labels[0]}anull[sfx_mix]")

    # Now duck the sfx_mix against the main video audio (input 0)
    # The main video is [0:a]. 
    # Actually, sidechaincompress uses the first input as main, and second as sidechain.
    # We want to duck the SFX when the VOICE is loud.
    # So main = sfx_mix, sidechain = [0:a].
    # But wait, we want the voice to remain unmodified, and the SFX to be ducked, 
    # then mix them both together.
    # Let's duck SFX: [sfx_mix][0:a]sidechaincompress=...[ducked_sfx]
    filter_parts.append(
        "[sfx_mix][0:a]sidechaincompress=threshold=0.1:ratio=4:attack=5:release=50[ducked_sfx]"
    )
    
    # Finally, mix the original voice [0:a] with the [ducked_sfx]
    filter_parts.append(
        "[0:a][ducked_sfx]amix=inputs=2:duration=first:dropout_transition=2[aout]"
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

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError:
        raise RuntimeError("ffmpeg not found. Please ensure ffmpeg is installed and on PATH.")

    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg exited with code {result.returncode}.\n"
            f"stderr:\n{result.stderr}"
        )

    return output_path

def _copy_file(src: str, dst: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(src, "rb") as f_in, open(dst, "wb") as f_out:
        while chunk := f_in.read(1 << 20):
            f_out.write(chunk)
