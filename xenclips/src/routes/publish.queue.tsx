import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Activity, ListOrdered, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePublishStore } from "@/lib/publish-store";
import { QueueItem } from "@/components/publish/QueueItem";

export const Route = createFileRoute("/publish/queue")({
  component: PublishQueue,
});

function PublishQueue() {
  const queue = usePublishStore((state) => state.queue);

  const activeCount = queue.filter((q) => q.status === "uploading").length;
  const queuedCount = queue.filter((q) => q.status === "queued").length;
  const completedCount = queue.filter((q) => q.status === "completed").length;
  const failedCount = queue.filter((q) => q.status === "failed").length;

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto animate-fade-in-up">
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/publish"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ListOrdered className="w-6 h-6 text-[#00F0FF]" />
            Upload Queue
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage parallel uploads and monitor real-time progress.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Activity className="w-4 h-4 text-[#00F0FF]" />}
          label="Active Uploads"
          value={activeCount}
          color="text-[#00F0FF]"
        />
        <StatCard
          icon={<ListOrdered className="w-4 h-4 text-gray-400" />}
          label="Queued"
          value={queuedCount}
          color="text-white"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-[#8A2BE2]" />}
          label="Completed"
          value={completedCount}
          color="text-[#8A2BE2]"
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-[#FF2A5F]" />}
          label="Failed"
          value={failedCount}
          color="text-[#FF2A5F]"
        />
      </div>

      <div className="space-y-4">
        <h2 className="label-section text-white flex items-center justify-between">
          <span>Processing Queue</span>
          <span className="text-[10px] text-gray-500">Max Concurrency: 2</span>
        </h2>

        {queue.length === 0 ? (
          <div className="glass-panel p-12 flex flex-col items-center justify-center text-center border-dashed border-white/20">
            <ListOrdered className="w-8 h-8 text-gray-600 mb-3" />
            <h3 className="text-white font-medium">Queue is Empty</h3>
            <p className="text-sm text-gray-500 mt-1">
              Go back to the Publish Center to add clips.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((item) => (
              <QueueItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-panel p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-display uppercase tracking-widest font-semibold text-gray-400">
          {label}
        </span>
      </div>
      <div className={`text-3xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
