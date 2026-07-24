import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useShortcuts } from "@/hooks/use-shortcuts";
import {
  Upload,
  Film,
  Settings as SettingsIcon,
  Scissors,
  Sparkles,
  Terminal,
  Send,
  Users,
  History as HistoryIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Upload", icon: Upload, exact: true },
  { to: "/clips", label: "Clips", icon: Film, exact: false },
  { to: "/history", label: "History", icon: HistoryIcon, exact: false },
  { to: "/publish", label: "Publish", icon: Send, exact: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, exact: false },
  { to: "/accounts", label: "Accounts", icon: Users, exact: false },
];

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { matchesShortcut } = useShortcuts();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, "navigateHome")) {
        e.preventDefault();
        navigate({ to: "/" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [matchesShortcut, navigate]);

  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/logs");
    ws.onmessage = (event) => {
      setLogs((prev) => {
        const newLogs = prev + event.data;
        return newLogs.length > 50000 ? newLogs.slice(newLogs.length - 50000) : newLogs;
      });
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (isTerminalOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [logs, isTerminalOpen]);

  return (
    <>
      <div className="animated-bg" />

      <div className="flex min-h-screen text-foreground relative z-10 p-6 gap-6">
        {/* ── Sidebar (Floating Glass Panel) ── */}
        <aside className="w-60 shrink-0 flex flex-col glass-panel overflow-hidden h-[calc(100vh-48px)] sticky top-6">
          {/* Logo */}
          <div className="px-6 pt-8 pb-6 select-none relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2]" />
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                }}
              >
                <Scissors
                  className="w-5 h-5"
                  style={{ color: "#00F0FF", filter: "drop-shadow(0 0 8px rgba(0,240,255,0.5))" }}
                />
              </div>
              <div>
                <div
                  className="font-display leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
                  style={{ fontSize: 22, fontWeight: 800 }}
                >
                  XENCLIPS
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    letterSpacing: "0.2em",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  STUDIO
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 mb-6">
            <div
              style={{
                height: 1,
                background: "linear-gradient(90deg, rgba(255,255,255,0.1), transparent)",
              }}
            />
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-2 px-4 flex-1">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-300 group overflow-hidden",
                  )}
                  style={{
                    background: active ? "rgba(255,255,255,0.05)" : "transparent",
                    border: `1px solid ${active ? "rgba(255,255,255,0.1)" : "transparent"}`,
                    color: active ? "#FFFFFF" : "var(--muted-foreground)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                      (e.currentTarget as HTMLElement).style.color = "#E4E4E7";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)";
                    }
                  }}
                >
                  {/* Active Indicator Glow */}
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#00F0FF] to-[#8A2BE2] shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
                  )}

                  <Icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-all duration-300",
                      active ? "text-[#00F0FF]" : "group-hover:text-white",
                    )}
                    style={active ? { filter: "drop-shadow(0 0 8px rgba(0,240,255,0.4))" } : {}}
                  />
                  <span
                    className="font-display tracking-wide"
                    style={{ fontSize: 14, fontWeight: active ? 600 : 500 }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Version */}
          <div className="p-6 mt-auto">
            <div
              className="glass-panel p-3 flex flex-col gap-3 rounded-xl"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#8A2BE2] flex items-center justify-center opacity-80">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--muted-foreground)",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    System Status
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#00F0FF",
                      fontWeight: 700,
                      filter: "drop-shadow(0 0 5px rgba(0,240,255,0.3))",
                    }}
                  >
                    Online · v0.4
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className="flex items-center gap-2 justify-center w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs font-medium text-white border border-white/10"
              >
                <Terminal className="w-4 h-4" />
                {isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 glass-panel overflow-y-auto h-[calc(100vh-48px)] relative">
          <Outlet />
        </main>
      </div>

      {/* ── Terminal Overlay ── */}
      {isTerminalOpen && (
        <div className="fixed bottom-6 right-6 w-[800px] max-w-[calc(100vw-300px)] h-[400px] z-50 glass-panel flex flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="px-4 py-3 bg-black/40 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#00F0FF]" />
              <span className="text-sm font-semibold text-white">Server Logs</span>
            </div>
            <button
              onClick={() => setIsTerminalOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-black/80 font-mono text-xs text-gray-300">
            <pre className="whitespace-pre-wrap break-all">{logs}</pre>
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </>
  );
}
