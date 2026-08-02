import pytest
from unittest.mock import patch, MagicMock
from viral_clip_selector import build_prompt, extract_clips

def test_build_prompt():
    """Test the dynamic prompt construction for Gemini."""
    prompt = build_prompt("Test transcript", clip_vibe="funny", hook_vibe="serious")
    assert "Test transcript" in prompt
    assert "Funny & Comedic" in prompt
    assert "Serious & Direct" in prompt

@patch("viral_clip_selector.model.generate_content")
def test_extract_clips_success(mock_generate_content):
    """Test extracting clips when Gemini returns valid JSON."""
    mock_response = MagicMock()
    mock_response.text = '```json\n{"clips": [{"start": 0.0, "end": 10.0, "reason": "funny", "title": "funny clip"}]}\n```'
    mock_generate_content.return_value = mock_response
    
    clips = extract_clips("dummy transcript")
    
    assert len(clips) == 1
    assert clips[0]["start"] == 0.0
    assert clips[0]["end"] == 10.0
    assert clips[0]["reason"] == "funny"

@patch("viral_clip_selector.model.generate_content")
def test_extract_clips_malformed_json(mock_generate_content):
    """Test extracting clips when Gemini returns garbage."""
    mock_response = MagicMock()
    mock_response.text = 'I am sorry, I cannot fulfill this request.'
    mock_generate_content.return_value = mock_response
    
    clips = extract_clips("dummy transcript")
    
    # Should handle gracefully and return empty list
    assert clips == []

@patch("viral_clip_selector.model.generate_content")
def test_extract_clips_missing_keys(mock_generate_content):
    """Test when Gemini returns JSON but missing required fields."""
    mock_response = MagicMock()
    mock_response.text = '```json\n{"clips": [{"start": 0.0}]}\n```'
    mock_generate_content.return_value = mock_response
    
    # Should catch the missing keys or return the incomplete dict
    clips = extract_clips("dummy transcript")
    assert len(clips) == 1
    assert clips[0].get("end") is None
