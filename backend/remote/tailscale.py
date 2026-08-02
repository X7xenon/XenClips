import subprocess
import json
import logging
import threading
import time

logger = logging.getLogger(__name__)

# Cached state
_state = {
    "connected": False,
    "ip": None,
    "hostname": None,
    "peers": [],
    "last_updated": 0
}

_lock = threading.Lock()

def get_tailscale_status():
    with _lock:
        return _state.copy()

def update_tailscale_status():
    try:
        # fetch full tailscale json status
        output = subprocess.check_output("tailscale status --json", shell=True, timeout=5).decode()
        data = json.loads(output)
        
        backend_state = data.get("BackendState", "")
        connected = (backend_state == "Running")
        
        self_ip = None
        self_node = data.get("Self", {})
        if self_node:
            ips = self_node.get("TailscaleIPs", [])
            if ips:
                self_ip = ips[0]
                
        hostname = self_node.get("HostName", None)
        
        peers = []
        for pk, peer in data.get("Peer", {}).items():
            peers.append({
                "name": peer.get("HostName", "Unknown"),
                "ip": peer.get("TailscaleIPs", [""])[0] if peer.get("TailscaleIPs") else "",
                "online": peer.get("Online", False),
                "os": peer.get("OS", "unknown")
            })

        with _lock:
            _state["connected"] = connected
            _state["ip"] = self_ip
            _state["hostname"] = hostname
            _state["peers"] = peers
            _state["last_updated"] = time.time()
            
    except Exception as e:
        logger.error(f"Failed to fetch tailscale status: {e}")
        with _lock:
            _state["connected"] = False
            _state["last_updated"] = time.time()

def _poller():
    while True:
        update_tailscale_status()
        time.sleep(30)  # Poll every 30 seconds

def start_tailscale_poller():
    t = threading.Thread(target=_poller, daemon=True)
    t.start()
    update_tailscale_status() # Initial fetch
