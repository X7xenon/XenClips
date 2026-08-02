import pytest
import os
import shutil
from clip_editor import _burn_captions_only, _build_hook_ass_file, get_ffmpeg_safe_ass_path

def test_get_ffmpeg_safe_ass_path():
    """Ensure path properly creates a temporary copy."""
    # We create a dummy ass file
    import tempfile
    fd, path = tempfile.mkstemp(suffix=".ass")
    os.close(fd)
    
    safe_path = get_ffmpeg_safe_ass_path(path)
    assert os.path.exists(safe_path)
    assert safe_path != path
    
    os.remove(path)
    os.remove(safe_path)

def test_build_hook_ass_file():
    """Test generating a hook text ASS file, ensuring backslashes and colons are properly escaped."""
    filter_string = _build_hook_ass_file("TEST HOOK TEXT", "mrbeast", 1080, 1920)
    
    assert "ass=" in filter_string
    # It must replace \ with / and : with \:
    # Example: C\:/Users/kumar/...
    assert "\\:" in filter_string
    assert "\\\\" not in filter_string

def test_burn_captions_only(dummy_video_path, dummy_audio_path):
    """Test the caption burn step runs without crashing (mocked to just return True or execute quickly)."""
    # Since we can't fully run 1080p FFmpeg in MS without a timeout risk, we'll test if it completes on a 1 sec dummy
    import tempfile
    out_path = os.path.join(tempfile.gettempdir(), "test_burn_out.mp4")
    
    try:
        _burn_captions_only(dummy_video_path, out_path, hook_text="MOCK", hook_style="default")
        assert os.path.exists(out_path)
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)

def test_clip_editor_invalid_input():
    """Test what happens if the input video is completely missing."""
    with pytest.raises(Exception):
        _burn_captions_only("Z:\\invalid_path_xyz_123.mp4", "out.mp4")
