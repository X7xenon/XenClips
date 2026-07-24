import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Server,
  Cpu,
  Database,
  Layout,
  Keyboard,
} from "lucide-react";
import {
  getApiBase,
  setApiBase,
  getSettings,
  saveSettings,
  api,
  getCurrentJob,
  type Settings,
  type LayoutTemplate,
  type GeminiKeyStatus,
} from "@/lib/api";
import { useEffect } from "react";
import { useShortcuts, saveShortcuts, type ShortcutConfig } from "@/hooks/use-shortcuts";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [apiBase, setBase] = useState(getApiBase());
  const [s, setS] = useState<Settings>(getSettings());
  const [saved, setSaved] = useState(false);
  
  const { shortcuts } = useShortcuts();
  const [tempShortcuts, setTempShortcuts] = useState<ShortcutConfig>(shortcuts);

  const [cleanupJobId, setCleanupJobId] = useState<string>(() => getCurrentJob() ?? "");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [cleanupOk, setCleanupOk] = useState(false);

  const [geminiKeys, setGeminiKeys] = useState<GeminiKeyStatus[]>([]);
  const [limitPerKey, setLimitPerKey] = useState<number>(50);
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    api
      .getGeminiSettings()
      .then((data) => {
        setGeminiKeys(data.keys);
        setLimitPerKey(data.limit_per_key);
      })
      .catch((e) => console.error("Failed to load Gemini settings", e));
  }, []);

  const save = async () => {
    setApiBase(apiBase.trim());
    saveSettings(s);
    saveShortcuts(tempShortcuts);
    try {
      await api.updateGeminiSettings(
        geminiKeys.map((k) => k.key),
        limitPerKey,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save Gemini settings", e);
      alert("Failed to save Gemini API Keys settings");
    }
  };

  const doCleanup = async () => {
    const id = cleanupJobId.trim();
    if (!id) return;
    if (
      !window.confirm(
        `Delete raw/intermediate files for job "${id}"?\n\nThis is IRREVERSIBLE — layout switches and re-exports will fail after cleanup.`,
      )
    )
      return;

    setCleanupBusy(true);
    setCleanupMsg(null);
    setCleanupOk(false);
    try {
      const res = await api.cleanupJob(id);
      setCleanupOk(true);
      setCleanupMsg(`Cleaned up ${(res as any).removed ?? "files"}.`);
    } catch (e) {
      setCleanupMsg((e as Error).message);
      setCleanupOk(false);
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-display text-[2.5rem] font-bold tracking-tight mb-2 text-white">
          System <span className="text-gradient">Preferences</span>
        </h1>
        <p className="text-gray-400 text-sm">
          Configure your local synthesis engine and manage disk resources.
        </p>
      </div>

      <div className="grid gap-8">
        {/* ── Engine Configuration ── */}
        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] flex items-center justify-center">
              <Server className="w-4 h-4 text-[#00F0FF]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              Engine Configuration
            </h2>
          </div>

          <div className="p-6 space-y-8 bg-[rgba(20,20,25,0.2)]">
            {/* API Base URL */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-gray-400" />
                <span className="label-section !mb-0 text-white">Backend Connection URL</span>
              </div>
              <input
                type="url"
                value={apiBase}
                onChange={(e) => setBase(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full text-sm font-mono text-[#00F0FF]"
              />
              <p className="text-[11px] text-gray-500 mt-2 font-medium">
                FastAPI base address. Modify only if running on a custom port.
              </p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-[rgba(255,255,255,0.05)] via-[rgba(255,255,255,0.01)] to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* FFmpeg encoder */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-gray-400" />
                  <span className="label-section !mb-0 text-white">Hardware Acceleration</span>
                </div>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { value: "auto", label: "Auto-detect Best", hint: "Recommended" },
                      { value: "qsv", label: "Intel QSV", hint: "Requires Intel Arc / iGPU" },
                      { value: "cpu", label: "Software (CPU)", hint: "Slowest, most compatible" },
                    ] as { value: Settings["encoder"]; label: string; hint: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setS({ ...s, encoder: opt.value })}
                      className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all duration-300 text-left ${
                        s.encoder === opt.value
                          ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF] shadow-[inset_0_0_20px_rgba(0,240,255,0.1)]"
                          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.2)]"
                      }`}
                    >
                      <span
                        className={`font-display font-bold text-sm tracking-wide ${s.encoder === opt.value ? "text-white" : "text-gray-300"}`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Whisper model */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-gray-400" />
                  <span className="label-section !mb-0 text-white">Transcription Model</span>
                </div>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        value: "small",
                        label: "Whisper Small",
                        hint: "Extremely fast, decent accuracy",
                      },
                      {
                        value: "medium",
                        label: "Whisper Medium",
                        hint: "Slower, studio-grade accuracy",
                      },
                    ] as { value: Settings["whisper_model"]; label: string; hint: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setS({ ...s, whisper_model: opt.value })}
                      className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all duration-300 text-left ${
                        s.whisper_model === opt.value
                          ? "bg-[rgba(138,43,226,0.15)] border-[#8A2BE2] shadow-[inset_0_0_20px_rgba(138,43,226,0.15)]"
                          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.2)]"
                      }`}
                    >
                      <span
                        className={`font-display font-bold text-sm tracking-wide ${s.whisper_model === opt.value ? "text-white" : "text-gray-300"}`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-[rgba(255,255,255,0.05)] via-[rgba(255,255,255,0.01)] to-transparent" />

            {/* Default layout */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layout className="w-4 h-4 text-gray-400" />
                <span className="label-section !mb-0 text-white">Default Layout Injection</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "full_vertical", label: "Vertical AI" },
                    { value: "bw_letterbox", label: "Cinematic" },
                    { value: "blur_bg", label: "Aura Blur" },
                    { value: "ishowspeed", label: "Speed Run" },
                    { value: "original", label: "Raw Format" },
                  ] as { value: LayoutTemplate; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setS({ ...s, default_layout: opt.value })}
                    className={`font-display font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-all duration-300 ${
                      s.default_layout === opt.value
                        ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF] text-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                        : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.05)] text-gray-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Save row */}
          <div className="px-6 py-4 bg-[rgba(10,10,15,0.6)] border-t border-[rgba(255,255,255,0.05)] flex items-center gap-4">
            <button onClick={save} className="btn-primary !px-6 !py-2.5">
              <Save className="w-4 h-4" />
              Commit Configuration
            </button>
            {saved && (
              <div className="flex items-center gap-2 animate-fade-in-up text-[#00F0FF] font-bold text-sm tracking-wider uppercase font-display">
                <CheckCircle2 className="w-4 h-4" />
                Successfully Applied
              </div>
            )}
          </div>
        </div>

        {/* ── Gemini API Keys Card ── */}
        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(138,43,226,0.1)] border border-[rgba(138,43,226,0.2)] flex items-center justify-center">
              <Database className="w-4 h-4 text-[#8A2BE2]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              Gemini API Keys
            </h2>
          </div>

          <div className="p-6 bg-[rgba(20,20,25,0.2)] space-y-6">
            <div className="max-w-xl flex items-end gap-4">
              <div className="flex-1">
                <label className="label-section !mb-2 text-white block">Add New API Key</label>
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full text-sm font-mono text-[#00F0FF]"
                />
              </div>
              <button
                onClick={() => {
                  if (newKey.trim()) {
                    setGeminiKeys([...geminiKeys, { key: newKey.trim(), used_today: 0 }]);
                    setNewKey("");
                  }
                }}
                className="btn-primary !px-6 !py-2.5 whitespace-nowrap"
              >
                Add Key
              </button>
            </div>

            <div className="max-w-xl">
              <label className="label-section !mb-2 text-white block">Daily Limit (Per Key)</label>
              <input
                type="number"
                value={limitPerKey}
                onChange={(e) => setLimitPerKey(parseInt(e.target.value) || 50)}
                className="w-32 text-sm font-mono text-[#00F0FF]"
                min="1"
              />
              <p className="text-[11px] text-gray-500 mt-2 font-medium">
                Number of API calls allowed per key per day to avoid quota errors.
              </p>
            </div>

            {geminiKeys.length > 0 && (
              <div className="max-w-xl space-y-2">
                <label className="label-section !mb-2 text-white block">Active Keys Pool</label>
                {geminiKeys.map((k, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-lg"
                  >
                    <div>
                      <div className="font-mono text-sm text-gray-300">
                        {k.key.substring(0, 8)}...{k.key.substring(k.key.length - 4)}
                      </div>
                      <div className="text-xs mt-1 font-medium text-gray-500">
                        <span
                          className={
                            k.used_today >= limitPerKey ? "text-[#FF2A5F]" : "text-[#00F0FF]"
                          }
                        >
                          {k.used_today} / {limitPerKey}
                        </span>{" "}
                        calls used today
                      </div>
                    </div>
                    <button
                      onClick={() => setGeminiKeys(geminiKeys.filter((_, idx) => idx !== i))}
                      className="p-2 hover:bg-[rgba(255,42,95,0.1)] hover:text-[#FF2A5F] text-gray-500 rounded-lg transition-colors"
                      title="Remove Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Keyboard Shortcuts Card ── */}
        <div className="glass-panel overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(10,10,15,0.4)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-[#00F0FF]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-white">
              Keyboard Shortcuts
            </h2>
          </div>

          <div className="p-6 bg-[rgba(20,20,25,0.2)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              {[
                { key: "toggleSidebar", label: "Toggle Sidebar" },
                { key: "interruptProcessing", label: "Interrupt Processing Dialog" },
                { key: "submitJob", label: "Submit Synthesis Job" },
                { key: "navigateHome", label: "Navigate Home" },
              ].map((shortcut) => (
                <div key={shortcut.key}>
                  <label className="label-section !mb-2 text-white block">
                    {shortcut.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-[rgba(255,255,255,0.1)] rounded text-gray-400 font-mono text-sm border border-[rgba(255,255,255,0.05)]">
                      Ctrl / Cmd +
                    </span>
                    <input
                      type="text"
                      maxLength={10}
                      value={tempShortcuts[shortcut.key as keyof ShortcutConfig]}
                      onChange={(e) =>
                        setTempShortcuts({
                          ...tempShortcuts,
                          [shortcut.key]: e.target.value.toLowerCase(),
                        })
                      }
                      className="w-20 text-center text-sm font-mono text-[#00F0FF] bg-transparent border-none outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-6 font-medium">
              Shortcuts take effect immediately across all windows once committed. Only single alphanumeric keys or Enter/Space are supported.
            </p>
          </div>
        </div>

        {/* ── Disk Cleanup Card ── */}
        <div className="glass-panel overflow-hidden border-[#FF2A5F]/30 shadow-[0_10px_40px_rgba(255,42,95,0.05)] relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF2A5F] opacity-5 blur-[100px] pointer-events-none rounded-full" />

          <div className="px-6 py-4 border-b border-[#FF2A5F]/10 bg-[rgba(255,42,95,0.03)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF2A5F]/10 border border-[#FF2A5F]/20 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-[#FF2A5F]" />
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-widest text-[#FF2A5F]">
              Storage Reclamation
            </h2>
          </div>

          <div className="p-6 bg-[rgba(20,20,25,0.4)]">
            <div className="flex items-start gap-4 mb-6 max-w-2xl">
              <div className="w-10 h-10 rounded-full bg-[rgba(255,42,95,0.1)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#FF2A5F]" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Purge Intermediate Files</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Permanently delete raw high-res cuts, separated audio tracks, and detection
                  matrices for a specific job.
                  <strong className="text-[#FF2A5F] font-semibold ml-1 block mt-1">
                    Warning: Layout re-rendering and raw video re-exports will permanently fail for
                    this job after purging.
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input
                type="text"
                value={cleanupJobId}
                onChange={(e) => {
                  setCleanupJobId(e.target.value);
                  setCleanupMsg(null);
                  setCleanupOk(false);
                }}
                placeholder="Target Job ID (e.g. a1b2c3d4e5)"
                className="flex-1 font-mono uppercase"
              />
              <button
                disabled={cleanupBusy || !cleanupJobId.trim()}
                onClick={doCleanup}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-display font-bold uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[rgba(255,42,95,0.15)] text-[#FF2A5F] border border-[#FF2A5F]/30 hover:bg-[#FF2A5F] hover:text-white"
              >
                <Trash2 className="w-4 h-4" />
                {cleanupBusy ? "Purging..." : "Execute Purge"}
              </button>
            </div>

            {cleanupMsg && (
              <div
                className={`mt-4 flex items-center gap-2 text-sm font-bold tracking-wide animate-fade-in-up ${cleanupOk ? "text-[#00F0FF]" : "text-[#FF2A5F]"}`}
              >
                {cleanupOk ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {cleanupMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
