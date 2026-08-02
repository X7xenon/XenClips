import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

DB_PATH = "db.json"

def get_system_stats() -> Dict[str, Any]:
    stats = {
        "cpu": 0,
        "ram": 0,
        "disk": 0,
        "disk_free_gb": 0,
        "queue_length": 0,
        "failed_uploads": 0,
        "processing_jobs": 0,
        "uploads_running": 0,
        "recent_logs": [],
        "psutil_available": HAS_PSUTIL
    }
    
    if HAS_PSUTIL:
        try:
            stats["cpu"] = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()
            stats["ram"] = mem.percent
            disk = psutil.disk_usage('/')
            stats["disk"] = disk.percent
            stats["disk_free_gb"] = round(disk.free / (1024 ** 3), 2)
        except Exception as e:
            logger.error(f"Failed to fetch psutil stats: {e}")
            
    # Read job stats from db.json
    try:
        if os.path.exists(DB_PATH):
            with open(DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                jobs = data.get("JOBS", {})
                
                queue_length = 0
                processing = 0
                failed = 0
                
                for j_id, j in jobs.items():
                    step = j.get("step", "")
                    if step in ["Queued", "Downloading", "Transcribing", "Generating AI Clips", "Rendering"]:
                        processing += 1
                        queue_length += 1
                    elif step == "Failed":
                        failed += 1
                        
                stats["queue_length"] = queue_length
                stats["processing_jobs"] = processing
                stats["failed_uploads"] = failed
    except Exception as e:
        logger.error(f"Failed to read db.json for stats: {e}")
        
    return stats
