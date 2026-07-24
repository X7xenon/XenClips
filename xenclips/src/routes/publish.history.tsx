import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, History, Trash2, Download } from "lucide-react";
import { usePublishStore, type Platform } from "@/lib/publish-store";
import { HistoryRow } from "@/components/publish/HistoryRow";
import { useState } from "react";

export const Route = createFileRoute("/publish/history")({
  component: PublishHistory,
});

function PublishHistory() {
  const history = usePublishStore((state) => state.history);
  const clearHistory = usePublishStore((state) => state.clearHistory);

  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");

  const filteredHistory = history.filter((item) => {
    if (filterPlatform !== "all" && item.platform !== filterPlatform) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const exportCSV = () => {
    if (history.length === 0) return;

    const headers = ["ID", "Clip ID", "Platform", "Title", "Date", "Status", "URL", "Error"];
    const rows = history.map((h) => [
      h.id,
      h.clipId,
      h.platform,
      `"${h.title.replace(/"/g, '""')}"`,
      new Date(h.date).toISOString(),
      h.status,
      h.url || "",
      `"${(h.error || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `xenclips_publish_history_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.click();
  };

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/publish"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <History className="w-6 h-6 text-[#00F0FF]" />
              Publish History
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Audit log of all uploaded clips and their statuses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={history.length === 0}
            className="btn-outline !py-2 !px-4 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear the entire publish history?")) {
                clearHistory();
              }
            }}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#FF2A5F]/30 text-[#FF2A5F] hover:bg-[#FF2A5F]/10 text-xs font-semibold font-display tracking-wide transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear Log
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Platform:</span>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as any)}
              className="bg-black/50 border border-white/10 rounded-md text-xs p-1"
            >
              <option value="all">All</option>
              <option value="youtube">YouTube Shorts</option>
              <option value="instagram">Instagram Reels</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-black/50 border border-white/10 rounded-md text-xs p-1"
            >
              <option value="all">All</option>
              <option value="success">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            Showing {filteredHistory.length} of {history.length} entries
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <History className="w-8 h-8 text-gray-600 mb-3 opacity-50" />
            <h3 className="text-white font-medium">No History Found</h3>
            <p className="text-sm text-gray-500 mt-1">
              Uploads will appear here once they complete or fail.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredHistory.map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
