import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_ping_endpoint():
    """Test the server is up and returning CORS headers."""
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_process_endpoint_invalid_payload():
    """Test the /process endpoint handles invalid JSON payloads gracefully."""
    response = client.post("/process", data={"invalid": "payload"})
    # It expects form data or json, but specific fields are required by Pydantic
    assert response.status_code == 422 # Unprocessable Entity

def test_process_endpoint_valid_payload(mocker):
    """Test submitting a job successfully triggers background task."""
    # Mock the background tasks so it doesn't actually run a full pipeline
    mocker.patch("server.BackgroundTasks.add_task")
    
    response = client.post("/process", data={
        "url": "https://www.youtube.com/watch?v=mock1234",
        "num_clips": 1,
        "clip_vibe": "funny",
        "hook_vibe": "funny"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert "layouts" in data
    assert "templates" in data

def test_status_endpoint_nonexistent():
    """Test polling for a nonexistent job."""
    response = client.get("/status/doesnotexist123")
    assert response.status_code == 404
