import os
import json
import datetime
from threading import Lock

USAGE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gemini_usage.json")

_lock = Lock()

def load_data():
    with _lock:
        if os.path.exists(USAGE_FILE):
            try:
                with open(USAGE_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return {"keys": [], "limit_per_key": 50, "model": "gemini-2.5-flash", "date": str(datetime.date.today()), "usage": {}}

def save_data(data):
    with _lock:
        with open(USAGE_FILE, 'w') as f:
            json.dump(data, f, indent=2)

def _check_reset(data):
    today = str(datetime.date.today())
    if data.get("date") != today:
        data["date"] = today
        data["usage"] = {}

def get_keys_status():
    data = load_data()
    _check_reset(data)
    save_data(data)
    
    status = []
    for key in data.get("keys", []):
        used = data.get("usage", {}).get(key, 0)
        status.append({"key": key, "used_today": used})
    
    return {"keys": status, "limit_per_key": data.get("limit_per_key", 50), "model": data.get("model", "gemini-2.5-flash")}

def set_keys_settings(keys, limit_per_key, model="gemini-2.5-flash"):
    data = load_data()
    _check_reset(data)
    data["keys"] = keys
    data["limit_per_key"] = limit_per_key
    data["model"] = model
    save_data(data)

def get_model():
    return load_data().get("model", "gemini-2.5-flash")

def get_available_key():
    data = load_data()
    _check_reset(data)
    save_data(data)
    
    limit = data.get("limit_per_key", 50)
    usage = data.get("usage", {})
    
    for key in data.get("keys", []):
        if usage.get(key, 0) < limit:
            return key
            
    # Fallback to env key if no keys are configured
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and not data.get("keys"):
        if usage.get(env_key, 0) < limit:
            return env_key
            
    raise ValueError("All Gemini API keys have reached their daily limit or no keys are configured.")

def increment_usage(api_key):
    data = load_data()
    _check_reset(data)
    if "usage" not in data:
        data["usage"] = {}
    data["usage"][api_key] = data["usage"].get(api_key, 0) + 1
    save_data(data)
