import sys
import time
import subprocess
import argparse
import os

# --- Constants ---
ASPECT_RATIO = 9 / 16

# Lazy-loaded models — initialized on first use so importing the module
# or running --help doesn't trigger heavyweight model loading.
_model = None
_face_cascade = None


def get_yolo_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO('yolov8n.pt')  # nano — smallest/fastest, CPU-friendly
    return _model


def get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        import cv2
        _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    return _face_cascade


def analyze_scene_content(video_path, scene_start_time, scene_end_time, num_samples=3):
    """Analyzes several frames across a scene (not just the middle one) to
    detect people and faces. Sampling only the middle frame was causing
    false LETTERBOX results whenever that single frame happened to catch
    the speaker mid-blink, turned away, or briefly out of frame.

    Seeks by TIME (milliseconds) rather than frame number — frame-number
    seeking (CAP_PROP_POS_FRAMES) is unreliable on files that were cut with
    `-c copy` (fast stream-copy, no re-encode), since those fragments often
    don't start on a keyframe and their frame-count metadata can be wrong.
    That was silently producing 0 detections (blank/failed reads) and
    forcing every scene to LETTERBOX even when a person was clearly visible.
    """
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return []

    start_sec = scene_start_time.get_seconds()
    end_sec = scene_end_time.get_seconds()
    span = max(0.01, end_sec - start_sec)

    fractions = [(i + 1) / (num_samples + 1) for i in range(num_samples)]
    sample_seconds = sorted(set(start_sec + span * f for f in fractions))

    best_detections = []
    reads_failed = 0
    for sec in sample_seconds:
        cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
        ret, frame = cap.read()
        if not ret or frame is None:
            reads_failed += 1
            continue

        results = get_yolo_model()(frame, imgsz=480, verbose=False)

        detected_objects = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                if box.cls[0] == 0:
                    x1, y1, x2, y2 = [int(i) for i in box.xyxy[0]]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
                    if x2 <= x1 or y2 <= y1:
                        continue
                    person_box = [x1, y1, x2, y2]

                    person_roi_gray = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
                    faces = get_face_cascade().detectMultiScale(person_roi_gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))

                    face_box = None
                    if len(faces) > 0:
                        fx, fy, fw, fh = faces[0]
                        face_box = [x1 + fx, y1 + fy, x1 + fx + fw, y1 + fy + fh]

                    detected_objects.append({'person_box': person_box, 'face_box': face_box})

        if len(detected_objects) > len(best_detections):
            best_detections = detected_objects

    if reads_failed == len(sample_seconds):
        print(f"[autocrop] WARNING: all {len(sample_seconds)} frame reads failed for scene "
              f"{start_sec:.1f}s-{end_sec:.1f}s — file may need re-encoding before autocrop.")

    cap.release()
    return best_detections


def detect_scenes(video_path, downscale=2, frame_skip=1):
    """Detect scene boundaries.

    Defaults tuned for CPU-only laptops: downscale=2 and frame_skip=1
    roughly halve analysis time with minimal accuracy loss for talking-head
    / podcast-style content (few rapid cuts).

    Supports both PySceneDetect >=0.6 (current `open_video` API) and the
    legacy <0.6 `VideoManager` API — `VideoManager` was removed in 0.6, so a
    fresh `pip install scenedetect` (which gets the latest version) would
    crash here with ImportError if we only supported the old API.
    """
    try:
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector())
        if downscale > 0:
            try:
                scene_manager.auto_downscale = False
                scene_manager.downscale = downscale
            except AttributeError:
                pass  # older/newer point release without this attribute — fine, just skip tuning
        scene_manager.detect_scenes(video=video, show_progress=True, frame_skip=frame_skip)
        scene_list = scene_manager.get_scene_list()
        fps = video.frame_rate
        return scene_list, fps

    except ImportError:
        # Legacy PySceneDetect (<0.6) — VideoManager-based API
        from scenedetect import VideoManager, SceneManager
        from scenedetect.detectors import ContentDetector
        video_manager = VideoManager([video_path])
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector())
        if downscale > 0:
            video_manager.set_downscale_factor(downscale)
        else:
            video_manager.set_downscale_factor()
        video_manager.start()
        scene_manager.detect_scenes(frame_source=video_manager, show_progress=True, frame_skip=frame_skip)
        scene_list = scene_manager.get_scene_list()
        fps = video_manager.get_framerate()
        video_manager.release()
        return scene_list, fps


def get_enclosing_box(boxes):
    if not boxes:
        return None
    min_x = min(box[0] for box in boxes)
    min_y = min(box[1] for box in boxes)
    max_x = max(box[2] for box in boxes)
    max_y = max(box[3] for box in boxes)
    return [min_x, min_y, max_x, max_y]


def decide_cropping_strategy(scene_analysis, frame_height, frame_width=None, force_fill=False):
    """
    force_fill=True (used by the "ishowspeed" layout): NEVER returns
    LETTERBOX. If no person is detected, or the group is too wide to fit,
    it falls back to a plain center-crop instead of adding black bars —
    always full-bleed 9:16.
    """
    def center_box():
        cx = (frame_width or 0) / 2
        return [cx - 1, 0, cx + 1, frame_height]

    num_people = len(scene_analysis)

    if num_people == 0:
        return ('TRACK', center_box()) if force_fill else ('LETTERBOX', None)

    if num_people == 1:
        target_box = scene_analysis[0]['face_box'] or scene_analysis[0]['person_box']
        return 'TRACK', target_box

    person_boxes = [obj['person_box'] for obj in scene_analysis]
    group_box = get_enclosing_box(person_boxes)
    group_width = group_box[2] - group_box[0]
    max_width_for_crop = frame_height * ASPECT_RATIO

    if group_width < max_width_for_crop:
        return 'TRACK', group_box
    if force_fill:
        return 'TRACK', group_box  # crop centered on the group even if it clips some people
    return 'LETTERBOX', None


def calculate_crop_box(target_box, frame_width, frame_height):
    target_center_x = (target_box[0] + target_box[2]) / 2
    crop_height = frame_height
    crop_width = int(crop_height * ASPECT_RATIO)
    x1 = int(target_center_x - crop_width / 2)
    y1 = 0
    x2 = int(target_center_x + crop_width / 2)
    y2 = frame_height

    if crop_width > frame_width:
        x1 = 0
        x2 = frame_width
    else:
        if x1 < 0:
            x1 = 0
            x2 = crop_width
        if x2 > frame_width:
            x2 = frame_width
            x1 = frame_width - crop_width
            
    return x1, y1, x2, y2


def get_video_properties(video_path):
    """Returns (width, height, fps) from OpenCV — the same backend that reads frames."""
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise IOError(f"Could not open video file {video_path}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return width, height, fps


def get_media_info(video_path):
    info = {}
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size',
             '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate',
             '-of', 'json', video_path],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            fmt = data.get('format', {})
            info['duration'] = float(fmt.get('duration', 0))
            info['size_bytes'] = int(fmt.get('size', 0))
            for stream in data.get('streams', []):
                if stream.get('codec_type') == 'video' and 'video_codec' not in info:
                    info['video_codec'] = stream.get('codec_name', 'unknown')
                    info['width'] = stream.get('width', 0)
                    info['height'] = stream.get('height', 0)
                    rate = stream.get('r_frame_rate', '0/1')
                    parts = rate.split('/')
                    if len(parts) == 2 and int(parts[1]) != 0:
                        info['fps'] = round(int(parts[0]) / int(parts[1]), 2)
                    else:
                        info['fps'] = float(parts[0])
                elif stream.get('codec_type') == 'audio' and 'audio_codec' not in info:
                    info['audio_codec'] = stream.get('codec_name', 'unknown')
    except (FileNotFoundError, ValueError, KeyError):
        pass
    return info


def format_duration(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}h {m:02d}m {s:02d}s"
    elif m > 0:
        return f"{m}m {s:02d}s"
    else:
        return f"{s}s"


def format_file_size(size_bytes):
    if size_bytes >= 1_073_741_824:
        return f"{size_bytes / 1_073_741_824:.1f} GB"
    elif size_bytes >= 1_048_576:
        return f"{size_bytes / 1_048_576:.1f} MB"
    elif size_bytes >= 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes} B"


def has_audio_stream(video_path):
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a',
             '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video_path],
            capture_output=True, text=True
        )
        return result.returncode == 0 and 'audio' in result.stdout
    except FileNotFoundError:
        return True


def get_stream_start_time(video_path, stream_type='v:0'):
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', stream_type,
             '-show_entries', 'stream=start_time', '-of', 'csv=p=0', video_path],
            capture_output=True, text=True
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except (FileNotFoundError, ValueError):
        pass
    return 0.0


def is_variable_frame_rate(video_path):
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=r_frame_rate,avg_frame_rate',
             '-of', 'csv=p=0', video_path],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return False
        parts = result.stdout.strip().split(',')
        if len(parts) < 2:
            return False

        def parse_rate(s):
            nums = s.strip().split('/')
            if len(nums) == 2 and int(nums[1]) != 0:
                return int(nums[0]) / int(nums[1])
            return float(nums[0])

        r_fps = parse_rate(parts[0])
        avg_fps = parse_rate(parts[1])
        return abs(r_fps - avg_fps) > 0.5
    except (FileNotFoundError, ValueError, ZeroDivisionError):
        return False


def run_ffmpeg_with_progress(command, total_duration, desc="Processing"):
    from tqdm import tqdm
    import re
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, universal_newlines=True)
    pbar = tqdm(total=int(total_duration), desc=desc, unit="s", bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt}s [{elapsed}<{remaining}]')
    time_pattern = re.compile(r'time=(\d+):(\d+):(\d+)\.(\d+)')
    last_seconds = 0
    stderr_lines = []
    for line in process.stderr:
        stderr_lines.append(line)
        match = time_pattern.search(line)
        if match:
            h, m, s, _ = match.groups()
            current_seconds = int(h) * 3600 + int(m) * 60 + int(s)
            if current_seconds > last_seconds:
                pbar.update(current_seconds - last_seconds)
                last_seconds = current_seconds
    pbar.update(max(0, int(total_duration) - last_seconds))
    pbar.close()
    process.wait()
    return process.returncode, ''.join(stderr_lines)


def normalize_to_cfr(video_path, output_path, total_duration=0):
    print("  Normalizing variable frame rate to constant frame rate...")
    command = ['ffmpeg', '-y', '-i', video_path, '-vsync', 'cfr', '-c:v', 'libx264',
               '-preset', 'fast', '-crf', '18', '-c:a', 'copy', output_path]
    if total_duration > 0:
        returncode, stderr_text = run_ffmpeg_with_progress(command, total_duration, desc="VFR → CFR")
    else:
        try:
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            return True
        except subprocess.CalledProcessError as e:
            print("  Warning: VFR normalization failed, proceeding with original file.")
            print("  Stderr:", e.stderr.decode())
            return False
    if returncode != 0:
        print("  Warning: VFR normalization failed, proceeding with original file.")
        return False
    return True


def detect_hw_encoder():
    """Probes FFmpeg for available hardware H.264 encoders.

    Returns (encoder_name, encoder_type). Checks Intel Quick Sync first since
    that's what's actually available on this laptop's UHD 620 iGPU — the
    original videotoolbox/nvenc-only check would never find hardware here.
    """
    candidates = [
        ('h264_qsv',           'qsv'),          # Intel Quick Sync — UHD 620 has this
        ('h264_videotoolbox',  'videotoolbox'), # macOS
        ('h264_nvenc',         'nvenc'),        # NVIDIA
    ]
    try:
        result = subprocess.run(['ffmpeg', '-hide_banner', '-encoders'], capture_output=True, text=True)
        for encoder, etype in candidates:
            if encoder in result.stdout:
                return encoder, etype
    except FileNotFoundError:
        pass
    return 'libx264', 'libx264'


def resolve_encoder(requested, hw_encoder_name, hw_encoder_type):
    if requested == 'auto':
        return 'libx264', 'libx264'
    elif requested == 'hw':
        return hw_encoder_name, hw_encoder_type
    else:
        if requested == hw_encoder_name:
            return hw_encoder_name, hw_encoder_type
        return requested, requested


def build_encoder_args(encoder_type, quality_level, crf_override=None, preset_override=None):
    presets = {
        'libx264': {
            'fast':     ['-crf', '28', '-preset', 'veryfast'],
            'balanced': ['-crf', '23', '-preset', 'fast'],
            'high':     ['-crf', '18', '-preset', 'slow'],
        },
        'videotoolbox': {
            'fast':     ['-b:v', '3M', '-allow_sw', '1', '-realtime', '0'],
            'balanced': ['-b:v', '6M', '-allow_sw', '1', '-realtime', '0'],
            'high':     ['-b:v', '12M', '-allow_sw', '1', '-realtime', '0'],
        },
        'nvenc': {
            'fast':     ['-cq', '28', '-preset', 'p1'],
            'balanced': ['-cq', '23', '-preset', 'p4'],
            'high':     ['-cq', '18', '-preset', 'p7'],
        },
        'qsv': {
            # UHD 620 Quick Sync — global_quality is QSV's analogue of CRF
            'fast':     ['-global_quality', '28', '-preset', 'veryfast'],
            'balanced': ['-global_quality', '23', '-preset', 'medium'],
            'high':     ['-global_quality', '18', '-preset', 'slow'],
        },
    }

    args = list(presets[encoder_type][quality_level])

    if encoder_type == 'libx264':
        if crf_override is not None:
            args[args.index('-crf') + 1] = str(crf_override)
        if preset_override is not None:
            args[args.index('-preset') + 1] = preset_override
    elif encoder_type == 'qsv' and preset_override is not None:
        args[args.index('-preset') + 1] = preset_override

    return args


# =========================================================================
# CALLABLE ENTRY POINT — used by clip_editor.py / clip_cutter.py pipeline
# =========================================================================

def process_video(
    input_path: str,
    output_path: str,
    ratio: str = "9:16",
    quality: str = "fast",       # laptop default: fast (CPU-only, no GPU)
    crf: int | None = None,
    preset: str | None = None,
    frame_skip: int = 2,          # laptop default: skip frames for faster scene detection on i5
    downscale: int = 3,           # laptop default: 3x downscale during scene detection on i5
    encoder: str = "hw",          # laptop default: try Quick Sync (QSV) first, else libx264
    force_fill: bool = False,     # "ishowspeed" mode: never letterbox — center-crop instead
) -> str:
    """Smart vertical-crop a horizontal video into 9:16 (or other ratio).

    Defaults are tuned for a CPU-only laptop (Intel UHD 620, no discrete GPU):
    - YOLOv8-nano (fastest model, already hardcoded in get_yolo_model)
    - frame_skip=1 and downscale=2 to speed up scene analysis (~2-4x faster,
      minor accuracy tradeoff — fine for talking-head/podcast content)
    - encoder='hw' tries Intel Quick Sync (h264_qsv) first; falls back to
      libx264 automatically if QSV isn't available in this FFmpeg build
    - quality='fast' uses veryfast/CRF28-equivalent settings
    - force_fill=True: when no person is detected (would normally letterbox
      with black bars), center-crop the frame to fill 9:16 instead. Always
      full-bleed, never bars — matches the "IShowSpeed style" always-vertical
      look where the frame is always fully cropped regardless of content.

    Returns output_path on success. Raises RuntimeError on failure.
    """
    global ASPECT_RATIO
    try:
        rw, rh = ratio.split(':')
        ASPECT_RATIO = int(rw) / int(rh)
    except (ValueError, IndexError, ZeroDivisionError):
        raise ValueError(f"Invalid ratio '{ratio}'. Use format W:H (e.g. 9:16)")

    import cv2
    import numpy as np
    from tqdm import tqdm

    hw_encoder_name, hw_encoder_type = detect_hw_encoder()
    encoder_name, encoder_type = resolve_encoder(encoder, hw_encoder_name, hw_encoder_type)
    enc_args = build_encoder_args(encoder_type, quality, crf_override=crf, preset_override=preset)

    _, ext = os.path.splitext(output_path)
    if not ext:
        output_path += '.mp4'

    base_name = os.path.splitext(output_path)[0]
    temp_video_output = f"{base_name}_temp_video.mp4"
    temp_audio_output = f"{base_name}_temp_audio.mkv"
    temp_cfr_input = f"{base_name}_temp_cfr_input.mp4"

    def cleanup_temp_files():
        for f in [temp_video_output, temp_audio_output, temp_cfr_input]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except OSError:
                    pass

    cleanup_temp_files()
    if os.path.exists(output_path):
        os.remove(output_path)

    working_input = input_path
    media_info = get_media_info(working_input)
    print(f"[autocrop] {os.path.basename(input_path)} | encoder={encoder_name} | quality={quality}")

    if is_variable_frame_rate(working_input):
        duration = media_info.get('duration', 0) if media_info else 0
        if normalize_to_cfr(working_input, temp_cfr_input, total_duration=duration):
            working_input = temp_cfr_input

    scenes, _ = detect_scenes(working_input, downscale=downscale, frame_skip=frame_skip)
    if not scenes:
        cleanup_temp_files()
        raise RuntimeError(f"No scenes detected in {input_path}")

    original_width, original_height, fps = get_video_properties(working_input)
    OUTPUT_HEIGHT = original_height + (original_height % 2)
    OUTPUT_WIDTH = int(OUTPUT_HEIGHT * ASPECT_RATIO)
    OUTPUT_WIDTH += OUTPUT_WIDTH % 2

    scenes_analysis = []
    for scene_idx, (start_time, end_time) in enumerate(scenes):
        analysis = analyze_scene_content(working_input, start_time, end_time)
        strategy, target_box = decide_cropping_strategy(
            analysis, original_height, frame_width=original_width, force_fill=force_fill
        )
        print(f"[autocrop] scene {scene_idx+1}/{len(scenes)}: {len(analysis)} person(s) detected → {strategy}")
        scenes_analysis.append({
            'start_frame': start_time.get_frames(),
            'end_frame': end_time.get_frames(),
            'strategy': strategy,
            'target_box': target_box,
        })

    command = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-s', f'{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}', '-pix_fmt', 'bgr24',
        '-r', str(fps), '-i', '-',
        '-c:v', encoder_name, *enc_args,
        '-pix_fmt', 'yuv420p',
        '-r', str(fps), '-vsync', 'cfr',
        '-an', temp_video_output
    ]

    ffmpeg_process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    cap = cv2.VideoCapture(working_input)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    frame_number = 0
    current_scene_index = 0
    dropped_frames = 0
    last_output_frame = None

    with tqdm(total=total_frames, desc="[autocrop] cropping", unit="fr") as pbar:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if current_scene_index < len(scenes_analysis) - 1 and \
               frame_number >= scenes_analysis[current_scene_index + 1]['start_frame']:
                current_scene_index += 1

            scene_data = scenes_analysis[current_scene_index]
            strategy = scene_data['strategy']
            target_box = scene_data['target_box']

            try:
                if strategy == 'TRACK':
                    crop_box = calculate_crop_box(target_box, original_width, original_height)
                    processed_frame = frame[crop_box[1]:crop_box[3], crop_box[0]:crop_box[2]]
                    output_frame = cv2.resize(processed_frame, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_LINEAR)
                elif force_fill:  # "ishowspeed" mode — no person detected, but still fill the
                                   # frame with a plain center crop instead of letterboxing
                    cx = original_width / 2
                    center_target = [cx - 1, 0, cx + 1, original_height]
                    crop_box = calculate_crop_box(center_target, original_width, original_height)
                    processed_frame = frame[crop_box[1]:crop_box[3], crop_box[0]:crop_box[2]]
                    output_frame = cv2.resize(processed_frame, (OUTPUT_WIDTH, OUTPUT_HEIGHT), interpolation=cv2.INTER_LINEAR)
                else:  # LETTERBOX
                    scale_factor = min(OUTPUT_WIDTH / original_width, OUTPUT_HEIGHT / original_height)
                    scaled_width = int(original_width * scale_factor)
                    scaled_height = int(original_height * scale_factor)
                    scaled_frame = cv2.resize(frame, (scaled_width, scaled_height), interpolation=cv2.INTER_LINEAR)
                    output_frame = np.zeros((OUTPUT_HEIGHT, OUTPUT_WIDTH, 3), dtype=np.uint8)
                    y_offset = (OUTPUT_HEIGHT - scaled_height) // 2
                    x_offset = (OUTPUT_WIDTH - scaled_width) // 2
                    output_frame[y_offset:y_offset + scaled_height, x_offset:x_offset + scaled_width] = scaled_frame
                last_output_frame = output_frame
            except Exception:
                dropped_frames += 1
                output_frame = last_output_frame if last_output_frame is not None else np.zeros((OUTPUT_HEIGHT, OUTPUT_WIDTH, 3), dtype=np.uint8)

            ffmpeg_process.stdin.write(output_frame.tobytes())
            frame_number += 1
            pbar.update(1)

    ffmpeg_process.stdin.close()
    stderr_output = ffmpeg_process.stderr.read().decode()
    ffmpeg_process.wait()
    cap.release()

    if ffmpeg_process.returncode != 0:
        cleanup_temp_files()
        raise RuntimeError(f"FFmpeg frame processing failed:\n{stderr_output[-2000:]}")

    input_has_audio = has_audio_stream(working_input)

    if input_has_audio:
        video_start = get_stream_start_time(working_input, 'v:0')
        audio_extract_command = ['ffmpeg', '-y', '-ss', str(video_start), '-i', working_input,
                                  '-vn', '-acodec', 'copy', temp_audio_output]
        try:
            subprocess.run(audio_extract_command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            cleanup_temp_files()
            raise RuntimeError(f"Audio extraction failed:\n{e.stderr.decode()[-2000:]}")

        merge_command = ['ffmpeg', '-y', '-i', temp_video_output, '-i', temp_audio_output,
                          '-c:v', 'copy', '-c:a', 'copy', '-shortest', output_path]
        try:
            subprocess.run(merge_command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            cleanup_temp_files()
            raise RuntimeError(f"Final merge failed:\n{e.stderr.decode()[-2000:]}")

        cleanup_temp_files()
    else:
        os.rename(temp_video_output, output_path)
        cleanup_temp_files()

    if dropped_frames > 0:
        print(f"[autocrop] Warning: {dropped_frames} frame(s) duplicated from previous frame (processing errors).")

    print(f"[autocrop] Done → {output_path}")
    return output_path


# =========================
# CLI (manual/standalone use)
# =========================
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Smartly crops a horizontal video into a vertical one.")
    parser.add_argument('-i', '--input', type=str, required=True)
    parser.add_argument('-o', '--output', type=str, required=True)
    parser.add_argument('--ratio', type=str, default='9:16')
    parser.add_argument('--quality', type=str, default='fast', choices=['fast', 'balanced', 'high'])
    parser.add_argument('--crf', type=int, default=None)
    parser.add_argument('--preset', type=str, default=None)
    parser.add_argument('--frame-skip', type=int, default=1)
    parser.add_argument('--downscale', type=int, default=2)
    parser.add_argument('--encoder', type=str, default='hw')
    parser.add_argument('--force-fill', action='store_true',
                         help="IShowSpeed mode: never letterbox, center-crop instead when no person detected")
    args = parser.parse_args()

    script_start = time.time()
    process_video(
        args.input, args.output,
        ratio=args.ratio, quality=args.quality, crf=args.crf, preset=args.preset,
        frame_skip=args.frame_skip, downscale=args.downscale, encoder=args.encoder,
        force_fill=args.force_fill,
    )
    print(f"Total time: {format_duration(time.time() - script_start)}")