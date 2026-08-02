import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Header
from typing import Optional
import json

from backend.remote.tailscale import get_tailscale_status
from backend.remote.stats import get_system_stats
from backend.remote.actions import execute_remote_action

router = APIRouter()
ws_clients = []

# Optional: Add a simple auth token check. For now, hardcode or read from env.
REMOTE_AUTH_TOKEN = "XENCLIPS_SECURE_TOKEN_2026" 

def verify_token(x_remote_key: str):
    if x_remote_key != REMOTE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid Remote Key")

@router.get("/status")
def get_remote_status():
    return {
        "tailscale": get_tailscale_status(),
        "stats": get_system_stats()
    }

@router.post("/action")
def perform_action(
    payload: dict,
    x_remote_key: str = Header(...)
):
    verify_token(x_remote_key)
    action = payload.get("action")
    confirmation = payload.get("confirmation")
    
    if not action:
        raise HTTPException(status_code=400, detail="Action required")
        
    if action in ["shutdown-pc", "restart-backend"] and confirmation != action.upper():
        raise HTTPException(status_code=400, detail="Confirmation required (e.g. RESTART-BACKEND)")
        
    return execute_remote_action(action)

async def _broadcast_stats():
    while True:
        if ws_clients:
            data = {
                "type": "stats_update",
                "tailscale": get_tailscale_status(),
                "stats": get_system_stats()
            }
            msg = json.dumps(data)
            dead_clients = []
            for client in ws_clients:
                try:
                    await client.send_text(msg)
                except Exception:
                    dead_clients.append(client)
            for c in dead_clients:
                if c in ws_clients:
                    ws_clients.remove(c)
                    
        await asyncio.sleep(2)  # broadcast every 2 seconds

_broadcaster_started = False

@router.websocket("/ws")
async def remote_ws(websocket: WebSocket):
    global _broadcaster_started
    
    # Optionally we could authenticate WS here via query param
    await websocket.accept()
    ws_clients.append(websocket)
    
    if not _broadcaster_started:
        _broadcaster_started = True
        asyncio.create_task(_broadcast_stats())
        
    try:
        while True:
            # wait for messages from client (e.g. heartbeat)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in ws_clients:
            ws_clients.remove(websocket)
