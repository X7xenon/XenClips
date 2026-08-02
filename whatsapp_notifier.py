import os
import json
import requests
import logging

logger = logging.getLogger(__name__)

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "settings.json")
NODE_BRIDGE_URL = "http://localhost:3001"

import subprocess
BRIDGE_PROC = None

def start_bridge():
    global BRIDGE_PROC
    if BRIDGE_PROC is not None:
        return
    bridge_path = r"X:\Millionaire\CreatorOS\backend\plugins\whatsapp-bridge"
    if os.path.exists(bridge_path):
        logger.info("Starting WhatsApp Bridge dynamically...")
        # Start detached with no window
        BRIDGE_PROC = subprocess.Popen(
            ["node", "index.js"],
            cwd=bridge_path,
            creationflags=subprocess.CREATE_NEW_CONSOLE | subprocess.CREATE_NO_WINDOW
        )

def stop_bridge():
    global BRIDGE_PROC
    if BRIDGE_PROC is not None:
        logger.info("Stopping WhatsApp Bridge...")
        try:
            BRIDGE_PROC.kill()
        except Exception as e:
            logger.error(f"Error stopping bridge process: {e}")
        BRIDGE_PROC = None
    # Also aggressively clean up any lingering bridge instances
    try:
        # Check if node is running from the bridge path, but for safety we just kill port 3001
        import psutil
        for conn in psutil.net_connections():
            if conn.laddr.port == 3001 and conn.pid:
                try:
                    p = psutil.Process(conn.pid)
                    p.terminate()
                except Exception:
                    pass
    except Exception:
        pass

def get_settings():
    if not os.path.exists(SETTINGS_FILE):
        return {"whatsapp_enabled": False, "whatsapp_number": ""}
    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"whatsapp_enabled": False, "whatsapp_number": ""}

def save_settings(settings: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)

def send_whatsapp_notification(message: str):
    settings = get_settings()
    if not settings.get("whatsapp_enabled"):
        return False
        
    target_number = settings.get("whatsapp_number")
    if not target_number:
        logger.error("WhatsApp is enabled but target number is missing.")
        return False
        
    try:
        response = requests.post(
            f"{NODE_BRIDGE_URL}/send",
            json={"number": target_number, "message": message},
            timeout=10
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send WhatsApp message: {e}")
        return False
