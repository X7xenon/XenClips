import pytest
import os
import sys
import subprocess
import tempfile
import uuid

# Add root directory to sys.path so tests can import modules directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def dummy_video_path():
    """Generates a 1-second 1920x1080 MP4 dummy video with a test pattern and silent audio, ensuring FFmpeg doesn't fail."""
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"dummy_{uuid.uuid4().hex[:8]}.mp4")
    
    # Generate 1 second of testsrc video with sine audio
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc=duration=1:size=1920x1080:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=1",
        "-c:v", "libx264", "-c:a", "aac",
        output_path
    ]
    
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    yield output_path
    
    if os.path.exists(output_path):
        try:
            os.remove(output_path)
        except:
            pass

@pytest.fixture
def dummy_audio_path():
    """Generates a 1-second dummy WAV audio file."""
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"dummy_audio_{uuid.uuid4().hex[:8]}.wav")
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=1",
        output_path
    ]
    
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    yield output_path
    
    if os.path.exists(output_path):
        try:
            os.remove(output_path)
        except:
            pass
