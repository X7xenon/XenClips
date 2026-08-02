import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useRemoteWs } from "../hooks/useRemoteWs";
import { getApiBase } from "../lib/api";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  Shield,
  Smartphone,
  Monitor,
  Power,
  RotateCcw,
  Trash2,
  Globe,
  Cpu,
  MemoryStick,
  HardDrive,
  List,
  Play,
  Pause,
  Upload,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/remote")({
  component: RemoteAccess,
});

function RemoteAccess() {
  const { tailscale, stats, wsStatus, sendAction } = useRemoteWs(getApiBase());
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleAction = async (action: string, confirmation?: string) => {
    try {
      const res = await sendAction(action, confirmation);
      alert(res.status || "Action executed");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "control", label: "Control Panel", icon: Power },
    { id: "qr", label: "QR Code", icon: Smartphone },
  ];

  const remoteUrl = tailscale?.ip ? `http://${tailscale.ip}:8080/remote` : "";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Globe className={tailscale?.connected ? "text-[#25D366]" : "text-red-500"} />
          Mission Control
        </h2>
        <div className="flex items-center gap-2 text-sm font-medium">
          WS:{" "}
          <span className={wsStatus === "connected" ? "text-green-400" : "text-yellow-400"}>
            {wsStatus}
          </span>
          {" | "}
          TS:{" "}
          <span className={tailscale?.connected ? "text-green-400" : "text-red-400"}>
            {tailscale?.connected ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="flex gap-2 border-b border-[rgba(255,255,255,0.1)] pb-4 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === t.id
                ? "bg-[var(--accent)] text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]"
                : "text-gray-400 hover:bg-white/5"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <Cpu className="text-[var(--accent)] mb-2" />
              <div className="text-sm text-gray-400">CPU Usage</div>
              <div className="text-2xl font-bold">{stats.cpu}%</div>
            </div>
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <MemoryStick className="text-[var(--accent)] mb-2" />
              <div className="text-sm text-gray-400">RAM Usage</div>
              <div className="text-2xl font-bold">{stats.ram}%</div>
            </div>
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <HardDrive className="text-[var(--accent)] mb-2" />
              <div className="text-sm text-gray-400">Disk Used</div>
              <div className="text-2xl font-bold">{stats.disk}%</div>
              <div className="text-xs text-gray-500">{stats.disk_free_gb} GB Free</div>
            </div>
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <List className="text-[var(--accent)] mb-2" />
              <div className="text-sm text-gray-400">Queue Length</div>
              <div className="text-2xl font-bold">{stats.queue_length}</div>
              <div className="text-xs text-gray-500">{stats.processing_jobs} processing</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "control" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleAction("pause-queue")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <Pause size={24} className="text-yellow-400" />
            <span className="font-bold">Pause Queue</span>
          </button>
          <button
            onClick={() => handleAction("resume-queue")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <Play size={24} className="text-green-400" />
            <span className="font-bold">Resume Queue</span>
          </button>
          <button
            onClick={() => handleAction("cancel-job")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <XCircle size={24} className="text-orange-400" />
            <span className="font-bold">Cancel Current Job</span>
          </button>
          <button
            onClick={() => handleAction("clear-temp")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <Trash2 size={24} className="text-yellow-400" />
            <span className="font-bold">Clear Temp Files</span>
          </button>
          <button
            onClick={() => handleAction("restart-backend", "RESTART-BACKEND")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <RotateCcw size={24} className="text-blue-400" />
            <span className="font-bold">Restart Backend</span>
          </button>
          <button
            onClick={() => handleAction("restart-frontend")}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-white/5 transition-all text-gray-300"
          >
            <Monitor size={24} className="text-purple-400" />
            <span className="font-bold">Kill Frontend</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to shut down the PC?")) {
                handleAction("shutdown-pc", "SHUTDOWN-PC");
              }
            }}
            className="glass-panel p-6 flex flex-col items-center gap-3 hover:bg-red-500/10 transition-all text-red-400 border border-red-500/20 col-span-1 sm:col-span-2"
          >
            <Power size={24} />
            <span className="font-bold">Shutdown PC</span>
          </button>
        </div>
      )}

      {activeTab === "qr" && (
        <div className="glass-panel p-8 flex flex-col items-center justify-center gap-6">
          {tailscale?.connected && remoteUrl ? (
            <>
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG value={remoteUrl} size={250} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Scan to open on phone</h3>
                <code className="bg-black/50 px-4 py-2 rounded text-[#25D366] text-sm block">
                  {remoteUrl}
                </code>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 p-8">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Tailscale must be running on this PC to generate a secure remote URL.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
