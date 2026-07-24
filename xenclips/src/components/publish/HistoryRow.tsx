import { formatDistanceToNow } from "date-fns";
import { ExternalLink, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import type { PublishHistoryItem } from "@/lib/publish-store";
import { PlatformBadge } from "./PlatformBadge";
import { uploadQueue } from "@/lib/upload-queue";

export function HistoryRow({ item }: { item: PublishHistoryItem }) {
  const isSuccess = item.status === "success";

  return (
    <div className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <PlatformBadge platform={item.platform} />

        <div className="flex-1 min-w-0">
          <h4 className="font-display font-medium text-white line-clamp-1">{item.title}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs text-gray-500 font-mono"
              title={new Date(item.date).toLocaleString()}
            >
              {formatDistanceToNow(item.date, { addSuffix: true })}
            </span>
            <span className="text-gray-600 text-[10px]">•</span>
            <span className="text-xs text-gray-500 font-mono">
              ID: {item.clipId.substring(0, 8)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0 pl-4">
        <div className="flex items-center justify-end w-24">
          {isSuccess ? (
            <div className="flex items-center gap-1.5 text-[#00F0FF]">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-display uppercase tracking-widest font-bold">
                Published
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#FF2A5F]" title={item.error}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-display uppercase tracking-widest font-bold">
                Failed
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-16 justify-end">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="View Post"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {!isSuccess && (
            <button
              className="p-2 rounded-lg text-gray-400 hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors"
              title="Retry Upload"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
