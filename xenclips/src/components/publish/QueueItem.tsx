import { Pause, Play, X, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { UploadQueueItem } from "@/lib/publish-store";
import { uploadQueue } from "@/lib/upload-queue";
import { PlatformBadge } from "./PlatformBadge";

export function QueueItem({ item }: { item: UploadQueueItem }) {
  const isFailed = item.status === "failed";
  const isCompleted = item.status === "completed";
  const isUploading = item.status === "uploading";
  const isPaused = item.status === "paused";

  return (
    <div
      className={`glass-panel p-4 flex flex-col gap-3 transition-all duration-300 ${isFailed ? "border-[#FF2A5F]/30 bg-[#FF2A5F]/5" : isUploading ? "border-[#00F0FF]/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]" : ""}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <PlatformBadge platform={item.platform} />
            <span className="text-xs text-gray-400 font-mono">
              ID: {item.clipId.substring(0, 8)}
            </span>
          </div>
          <h4 className="font-display font-semibold text-white line-clamp-1">
            {item.metadata.title || "Untitled Upload"}
          </h4>
          {isFailed && item.error && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#FF2A5F]">
              <AlertTriangle className="w-3 h-3" />
              <span>{item.error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isUploading && (
            <button
              onClick={() => uploadQueue.pause(item.id)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => uploadQueue.resume(item.id)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {isFailed && (
            <button
              onClick={() => uploadQueue.retry(item.id)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-[#00F0FF]"
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {!isCompleted && (
            <button
              onClick={() => uploadQueue.cancel(item.id)}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-[#FF2A5F]"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(138,43,226,0.15)] text-[#D68AFF] border border-[rgba(138,43,226,0.3)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-bold font-display uppercase tracking-widest">Done</span>
            </div>
          )}
        </div>
      </div>

      {!isFailed && !isCompleted && (
        <div className="relative pt-1">
          <div className="flex mb-1 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block text-gray-400 uppercase tracking-widest font-display">
                {item.status}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-[#00F0FF]">
                {Math.round(item.progress)}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-1.5 mb-2 text-xs flex rounded-full bg-white/5 border border-white/10">
            <div
              style={{ width: `${item.progress}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-300 ${isPaused ? "bg-gray-500" : "bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2]"}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
