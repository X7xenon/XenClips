import { useState, useEffect, useRef } from "react";

export interface TailscaleState {
  connected: boolean;
  ip: string | null;
  hostname: string | null;
  peers: any[];
  last_updated: number;
}

export interface SystemStats {
  cpu: number;
  ram: number;
  disk: number;
  disk_free_gb: number;
  queue_length: number;
  failed_uploads: number;
  processing_jobs: number;
  uploads_running: number;
  recent_logs: string[];
  psutil_available: boolean;
}

export const useRemoteWs = (apiBase: string) => {
  const [tailscale, setTailscale] = useState<TailscaleState | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">(
    "disconnected",
  );
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Convert http(s):// url to ws(s)://
    let wsUrl = apiBase.replace("http://", "ws://").replace("https://", "wss://");
    if (wsUrl.endsWith("/")) {
      wsUrl = wsUrl.slice(0, -1);
    }
    wsUrl += "/api/remote/ws";

    const connect = () => {
      setWsStatus("connecting");
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsStatus("connected");

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "stats_update") {
            setTailscale(data.tailscale);
            setStats(data.stats);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [apiBase]);

  const sendAction = async (action: string, confirmation?: string) => {
    const res = await fetch(`${apiBase}/api/remote/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Remote-Key": "XENCLIPS_SECURE_TOKEN_2026",
      },
      body: JSON.stringify({ action, confirmation }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Action failed");
    }
    return await res.json();
  };

  return { tailscale, stats, wsStatus, sendAction };
};
