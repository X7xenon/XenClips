import pytest
import os
from unittest.mock import patch, MagicMock
from whisper_transcriber import transcribe_audio

@pytest.fixture
def mock_whisper_model():
    with patch("whisper_transcriber.WhisperModel") as MockModel:
        mock_instance = MockModel.return_value
        
        # Mock transcription segments
        segment1 = MagicMock()
        segment1.start = 0.0
        segment1.end = 1.0
        segment1.text = " Hello world."
        
        word1 = MagicMock()
        word1.start = 0.0
        word1.end = 0.5
        word1.word = "Hello"
        
        word2 = MagicMock()
        word2.start = 0.5
        word2.end = 1.0
        word2.word = "world."
        
        segment1.words = [word1, word2]
        
        # mock_instance.transcribe returns an iterator of segments, and an info object
        info = MagicMock()
        info.language = "en"
        info.language_probability = 0.99
        
        mock_instance.transcribe.return_value = ([segment1], info)
        
        yield mock_instance

def test_transcribe_audio(dummy_audio_path, mock_whisper_model):
    """Test transcribing audio returns correct formatted segments and words."""
    result = transcribe_audio(dummy_audio_path)
    
    assert "segments" in result
    assert "words" in result
    
    segments = result["segments"]
    words = result["words"]
    
    assert len(segments) == 1
    assert segments[0]["text"] == " Hello world."
    
    assert len(words) == 2
    assert words[0]["word"] == "Hello"
    assert words[1]["word"] == "world."

def test_transcribe_missing_file():
    """Test transcribing a missing file throws FileNotFoundError."""
    with pytest.raises(Exception):
        transcribe_audio("nonexistent_path_xyz_123.wav")
