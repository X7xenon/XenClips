import pytest
import os
import shutil
from video_downloader import download_video

def test_download_video_local_file(dummy_video_path):
    """Test downloading a local video file (which simply copies it to a workspace)."""
    result = download_video(dummy_video_path)
    
    assert result is not None
    assert "title" in result
    assert "workspace" in result
    assert "video_path" in result
    
    # Assert workspace was created
    assert os.path.exists(result["workspace"])
    
    # Assert video was copied to input folder
    assert os.path.exists(result["video_path"])
    
    # Clean up workspace after test
    shutil.rmtree(result["workspace"], ignore_errors=True)

def test_download_invalid_url():
    """Test downloading an invalid URL raises an exception or fails gracefully."""
    with pytest.raises(Exception):
        download_video("https://www.youtube.com/watch?v=invalid_id_xyz_123")
