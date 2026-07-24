import os
import random

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PACKS_DIR = os.path.join(os.path.dirname(_SCRIPT_DIR), "assets", "sfx", "packs")
_LEGACY_SFX_DIR = os.path.join(os.path.dirname(_SCRIPT_DIR), "Sound effects")

# Cooldown per category in seconds
SMART_COOLDOWNS = {
    "impact": 0.8,
    "dramatic_hit": 0.8,
    "success": 1.0,
    "ding": 0.5,
    "surprise": 0.5,
    "pop": 0.3,
    "caption_pop": 0.3,
    "bounce": 0.4,
    "emoji": 0.3,
    "zoom": 0.6,
    "whoosh": 0.5,
    "error": 1.0,
    "censor": 1.0,
    "highlight": 0.5
}

# Fallback mapping if event doesn't exactly match a folder name
EVENT_TO_FOLDER = {
    "impact": "dramatic_hit",
    "success": "ding",
    "surprise": "pop",
    "caption_pop": "pop",
    "bounce": "pop",
    "emoji": "pop",
    "zoom": "whoosh",
    "highlight": "ding",
    "error": "censor"
}

def get_sfx_candidates(event_type: str, pack: str = "default") -> list[str]:
    """
    Returns a list of absolute paths to audio files for the given event and pack.
    Falls back to the legacy flat directory if the pack structure isn't set up yet.
    """
    candidates = []
    
    # Check pack folder first
    folder_name = EVENT_TO_FOLDER.get(event_type, event_type)
    pack_dir = os.path.join(_PACKS_DIR, pack, folder_name)
    
    if os.path.isdir(pack_dir):
        for entry in os.listdir(pack_dir):
            if entry.endswith((".wav", ".mp3", ".m4a")):
                candidates.append(os.path.join(pack_dir, entry))
    
    # If no candidates in pack, fallback to default pack
    if not candidates and pack != "default":
        default_dir = os.path.join(_PACKS_DIR, "default", folder_name)
        if os.path.isdir(default_dir):
            for entry in os.listdir(default_dir):
                if entry.endswith((".wav", ".mp3", ".m4a")):
                    candidates.append(os.path.join(default_dir, entry))
                    
    # If still no candidates, fallback to legacy substring matching
    if not candidates and os.path.isdir(_LEGACY_SFX_DIR):
        # We emulate the old categorize_sfx_file behavior
        # folder_name corresponds loosely to old categories
        substrings = []
        if folder_name == "whoosh": substrings = ["whoosh", "run-vine", "switch"]
        elif folder_name == "ding": substrings = ["notification", "ding", "camera", "tudum"]
        elif folder_name == "dramatic_hit": substrings = ["cinematic-suspense", "shocking", "vine-boom", "dramatic"]
        elif folder_name == "pop": substrings = ["maro-jump", "cartoonslip", "slap", "mac-quack", "deepbark", "meow"]
        elif folder_name == "censor": substrings = ["censor-beep", "windows-error"]
        
        for entry in os.listdir(_LEGACY_SFX_DIR):
            entry_lower = entry.lower()
            if any(sub in entry_lower for sub in substrings):
                candidates.append(os.path.join(_LEGACY_SFX_DIR, entry))
                
    return candidates

def map_events_to_audio(events: list[dict], pack: str = "default") -> list[dict]:
    """
    Maps logical events to physical audio file paths.
    Enforces category-based cooldowns and anti-repetition.
    """
    mapped_cues = []
    
    last_played_time = {}      # category -> timestamp
    last_played_file = {}      # category -> filepath
    
    for ev in events:
        event_type = ev["event"]
        ev_time = ev["time"]
        
        cooldown = SMART_COOLDOWNS.get(event_type, 0.5)
        last_time = last_played_time.get(event_type, -999.0)
        
        # Enforce cooldown
        if ev_time - last_time < cooldown:
            continue
            
        candidates = get_sfx_candidates(event_type, pack)
        if not candidates:
            continue
            
        # Enforce anti-repetition if we have multiple candidates
        if len(candidates) > 1:
            last_file = last_played_file.get(event_type)
            if last_file in candidates:
                # Remove last played file from choices this round
                candidates = [c for c in candidates if c != last_file]
                
        chosen_file = random.choice(candidates)
        
        last_played_time[event_type] = ev_time
        last_played_file[event_type] = chosen_file
        
        mapped_cues.append({
            "time_offset": ev_time,
            "type": event_type,
            "path": chosen_file,
            "confidence": ev.get("confidence", 1.0)
        })
        
    return mapped_cues
