import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History as HistoryIcon, Play, AlertTriangle, Trash2, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { api, type JobStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

type HistoryJob = {
  job_id: string;
  step: string;
  progress: number;
  error?: string;
  clip_count: number;
  creation_date?: string;
  project_name?: string;
  source_video?: string;
  smart_zoom_enabled?: boolean;
  speed_ramp_enabled?: boolean;
  watermark_enabled?: boolean;
  sfx_enabled?: boolean;
  duration?: number;
  resolution?: string;
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function HistoryPage() {
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .jobs()
      .then((data) => {
        if (!cancelled) {
          // Sort by newest first assuming job_id roughly correlates or we have creation_date
          const sorted = data.sort((a: any, b: any) => {
            if (a.creation_date && b.creation_date) {
              return new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime();
            }
            return 0;
          });
          setJobs(sorted as HistoryJob[]);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deleteJob = async (jobId: string) => {
    // API endpoint doesn't exist yet, but let's just remove from UI for now
    setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
  };

  return (
    <div className="p-8 pb-20 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00F0FF]/20 to-[#8A2BE2]/20 flex items-center justify-center border border-white/10">
            <HistoryIcon className="w-6 h-6 text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="font-display text-[2.5rem] font-bold tracking-tight text-white leading-none">
              Creation <span className="text-gradient">History</span>
            </h1>
            <p className="text-gray-400 mt-2 font-medium">Timeline of all projects and clips generated.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 font-medium">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
            <RotateCcw className="w-8 h-8 animate-spin text-[#00F0FF]" />
            <span className="font-medium">Loading history...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <HistoryIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No projects created yet.</p>
            <Link to="/" className="mt-4 text-[#00F0FF] hover:underline">Start a new project</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.job_id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:border-white/20 transition-all">
                {/* Decorative Side Gradient */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#00F0FF] to-[#8A2BE2] opacity-50" />
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">
                        {job.project_name || `Project ${job.job_id.substring(0, 6).toUpperCase()}`}
                      </h2>
                      <div className="text-xs text-gray-400 flex items-center gap-3">
                        <span>{job.creation_date ? new Date(job.creation_date).toLocaleString() : 'Unknown Date'}</span>
                        <span>•</span>
                        <span className={cn(
                          job.step === "Done" ? "text-green-400" :
                          job.error ? "text-red-400" : "text-yellow-400"
                        )}>
                          {job.error ? 'Failed' : job.step === "Done" ? 'Completed' : 'Processing'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link
                        to={`/clips`}
                        search={{}}
                        onClick={() => {
                          localStorage.setItem("activeJob", job.job_id);
                        }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                        title="Open Project"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors" title="Duplicate">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteJob(job.job_id)} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Source Video</div>
                      <div className="text-sm text-gray-300 truncate" title={job.source_video || 'N/A'}>
                        {job.source_video || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Duration</div>
                      <div className="text-sm text-gray-300">
                        {job.duration ? formatDuration(job.duration) : 'Auto'}
                      </div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Export Res</div>
                      <div className="text-sm text-gray-300">
                        {job.resolution || '1080x1920'}
                      </div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Clips Generated</div>
                      <div className="text-sm text-gray-300">
                        {job.clip_count}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge active={job.smart_zoom_enabled} label="Smart Zoom" />
                    <Badge active={job.speed_ramp_enabled} label="Speed Ramps" />
                    <Badge active={job.watermark_enabled} label="Watermark" />
                    <Badge active={job.sfx_enabled} label="Sound Effects" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ active, label }: { active?: boolean; label: string }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#8A2BE2]/20 text-[#D8B4FE] border border-[#8A2BE2]/30">
      {label}
    </span>
  );
}
