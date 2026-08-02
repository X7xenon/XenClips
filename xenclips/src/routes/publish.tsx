import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  UploadCloud,
  List,
  History,
  Settings2,
  PlaySquare,
  Upload as UploadIcon,
  FileText,
} from "lucide-react";
import { api, getCurrentJob, type Clip } from "@/lib/api";
import { usePublishStore, type Platform } from "@/lib/publish-store";
import {
  generateYouTubeMetadata,
  generateInstagramMetadata,
  type PlatformMetadata,
} from "@/lib/metadata-generator";
import { MetadataPanel } from "@/components/publish/MetadataPanel";

export const Route = createFileRoute("/publish")({
  component: PublishHub,
});

function PublishHub() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [metadata, setMetadata] = useState<Record<string, PlatformMetadata>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [jobs, setJobs] = useState<Array<{ job_id: string; clip_count: number }>>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accounts = usePublishStore((state) => state.accounts);
  const enqueue = usePublishStore((state) => state.enqueue);

  // Fetch all available jobs on mount
  useEffect(() => {
    api
      .jobs()
      .then((data) => {
        setJobs(data);
        const current = getCurrentJob();
        if (current && data.some((j) => j.job_id === current)) {
          setSelectedJobId(current);
        } else if (data.length > 0) {
          setSelectedJobId(data[0].job_id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch clips when a job is selected
  useEffect(() => {
    if (selectedJobId) {
      api.clips(selectedJobId).then(setClips).catch(console.error);
    } else {
      setClips([]);
    }
    setSelectedClip(null); // Reset clip selection
  }, [selectedJobId]);

  // Set default account when platform changes
  useEffect(() => {
    const platformAccounts = accounts.filter((a) => a.platform === platform);
    const defaultAcc = platformAccounts.find((a) => a.isDefault) || platformAccounts[0];
    if (defaultAcc) {
      setSelectedAccountId(defaultAcc.id);
    } else {
      setSelectedAccountId("");
    }
  }, [platform, accounts]);

  const handleGenerate = async (clip: Clip, targetPlatform: Platform) => {
    setIsGenerating(true);
    try {
      const result =
        targetPlatform === "youtube"
          ? await generateYouTubeMetadata(clip)
          : await generateInstagramMetadata(clip);

      setMetadata((prev) => ({
        ...prev,
        [`${clip.clip_id}-${targetPlatform}`]: result,
      }));
    } catch (e) {
      console.error(e);
      alert("Failed to generate metadata. Please check your AI API keys in Accounts.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectClip = (clip: Clip) => {
    setSelectedClip(clip);
    if (!metadata[`${clip.clip_id}-${platform}`]) {
      handleGenerate(clip, platform);
    }
  };

  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    if (selectedClip && !metadata[`${selectedClip.clip_id}-${p}`]) {
      handleGenerate(selectedClip, p);
    }
  };

  const handleEnqueue = () => {
    if (!selectedClip) return;
    if (!selectedAccountId) {
      alert(`No ${platform} accounts found. Please add one in the Accounts page.`);
      return;
    }

    const meta = metadata[`${selectedClip.clip_id}-${platform}`];

    enqueue({
      clipId: selectedClip.clip_id,
      platform,
      accountId: selectedAccountId,
      metadata: meta || {},
    });

    alert("Added to upload queue!");
  };

  const handleFilesDrop = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const videos = fileArray.filter((f) => f.type.startsWith("video/"));
    const subtitles = fileArray.filter(
      (f) => f.name.endsWith(".srt") || f.name.endsWith(".txt") || f.name.endsWith(".vtt"),
    );

    const newClips: Clip[] = [];

    for (const video of videos) {
      // Find matching subtitle by base name
      const baseName = video.name.substring(0, video.name.lastIndexOf("."));
      const subtitle = subtitles.find((s) => s.name.startsWith(baseName));

      let hook_text = "Local Custom Clip";

      if (subtitle) {
        try {
          const text = await subtitle.text();
          // Extremely basic SRT/VTT parser to get just the spoken text
          const lines = text.split("\n");
          const spokenLines = lines
            .map((l) => l.trim())
            .filter((l) => l && isNaN(Number(l)) && !l.includes("-->") && !l.startsWith("WEBVTT"));

          if (spokenLines.length > 0) {
            hook_text = spokenLines.join(" ").substring(0, 500); // Take first 500 chars as hook/context
          }
        } catch (e) {
          console.error("Failed to parse subtitle", e);
        }
      }

      newClips.push({
        clip_id: `local-${Math.random().toString(36).substring(7)}`,
        job_id: "local",
        hook_text,
        thumbnail_url: URL.createObjectURL(video),
        duration: 0,
        emoji: "🎥",
      });
    }

    if (newClips.length > 0) {
      setClips((prev) => [...newClips, ...prev]);
      setSelectedJobId(""); // clear job selection
    }
  };

  return (
    <div className="p-8 pb-20 max-w-6xl mx-auto h-full flex flex-col animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Send className="w-8 h-8 text-[#00F0FF]" />
            Publish Center
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Generate AI metadata and queue your clips for upload.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/publish/queue" className="btn-outline">
            <List className="w-4 h-4" /> Queue
          </Link>
          <Link to="/publish/history" className="btn-outline">
            <History className="w-4 h-4" /> History
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 flex-1 min-h-0">
        {/* Left Column: Clips List */}
        <div className="glass-panel overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h2 className="label-section !mb-3 text-white flex items-center gap-2">
              <PlaySquare className="w-4 h-4" /> Ready to Publish
            </h2>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full text-xs mb-3"
            >
              <option value="" disabled>
                Select a processing job...
              </option>
              {jobs.map((job) => (
                <option key={job.job_id} value={job.job_id}>
                  Job: {job.job_id.substring(0, 8)} ({job.clip_count} clips)
                </option>
              ))}
            </select>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) handleFilesDrop(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative group cursor-pointer transition-all duration-300 rounded-xl border-2 border-dashed p-4 text-center ${
                dragOver
                  ? "border-[#00F0FF] bg-[rgba(0,240,255,0.05)]"
                  : "border-[rgba(255,255,255,0.1)] bg-[rgba(20,20,25,0.4)] hover:border-[rgba(255,255,255,0.2)]"
              }`}
            >
              <UploadIcon
                className={`w-6 h-6 mx-auto mb-2 transition-colors ${dragOver ? "text-[#00F0FF]" : "text-gray-500"}`}
              />
              <div className="text-xs font-medium text-gray-300">Drop custom clips</div>
              <div className="text-[10px] text-gray-500 mt-1">
                Include .srt to auto-read subtitles
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,.srt,.vtt,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFilesDrop(e.target.files);
                }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {clips.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No clips found. Process a video first.
              </div>
            ) : (
              clips.map((clip, idx) => (
                <button
                  key={clip.clip_id}
                  onClick={() => handleSelectClip(clip)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-300 flex gap-3 ${
                    selectedClip?.clip_id === clip.clip_id
                      ? "bg-[rgba(0,240,255,0.1)] border-[#00F0FF]/30 shadow-[inset_0_0_15px_rgba(0,240,255,0.05)]"
                      : "bg-white/5 border-transparent hover:border-white/10"
                  }`}
                >
                  <div className="w-16 h-24 rounded bg-black/50 shrink-0 border border-white/10 overflow-hidden relative">
                    {clip.thumbnail_url ? (
                      <img
                        src={clip.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-600 font-mono">
                        NO THUMB
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <div className="text-xs font-mono text-gray-500 mb-1">
                      Clip {clip.clip_number || idx + 1}
                    </div>
                    <div className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                      {clip.hook_text || "Untitled Clip"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Metadata & Queue Action */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-2">
          {selectedClip ? (
            <>
              {/* Platform Toggle */}
              <div className="glass-panel p-2 flex justify-center sticky top-0 z-10">
                <div className="segmented-control w-full max-w-sm">
                  <button
                    className={`segmented-btn flex-1 text-center ${platform === "youtube" ? "active" : ""}`}
                    onClick={() => handlePlatformChange("youtube")}
                  >
                    YouTube Shorts
                  </button>
                  <button
                    className={`segmented-btn flex-1 text-center ${platform === "instagram" ? "active" : ""}`}
                    onClick={() => handlePlatformChange("instagram")}
                  >
                    Instagram Reels
                  </button>
                </div>
              </div>

              {/* Metadata Panel */}
              <div className="glass-panel p-6">
                <MetadataPanel
                  platform={platform}
                  metadata={metadata[`${selectedClip.clip_id}-${platform}`] || null}
                  isGenerating={isGenerating}
                  onRegenerate={() => handleGenerate(selectedClip, platform)}
                  onChange={(p, updated) =>
                    setMetadata((prev) => ({ ...prev, [`${selectedClip.clip_id}-${p}`]: updated }))
                  }
                />
              </div>

              {/* Quick Queue Action */}
              <div className="glass-panel p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border-[#00F0FF]/20 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-48 h-48 bg-gradient-to-tl from-[#00F0FF]/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

                <div className="flex-1 min-w-0">
                  <label className="label-section block text-white mb-2">Publish As</label>
                  <div className="flex items-center gap-2">
                    {accounts.filter((a) => a.platform === platform).length === 0 ? (
                      <div className="text-sm text-[#FF2A5F] flex items-center gap-2">
                        No {platform} accounts configured.{" "}
                        <Link to="/accounts" className="underline font-bold">
                          Add one
                        </Link>
                      </div>
                    ) : (
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="max-w-[200px]"
                      >
                        {accounts
                          .filter((a) => a.platform === platform)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              @{a.username}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleEnqueue}
                  disabled={!selectedAccountId || isGenerating}
                  className="btn-primary w-full sm:w-auto !py-3 px-8"
                >
                  <UploadCloud className="w-4 h-4" />
                  Add to Upload Queue
                </button>
              </div>
            </>
          ) : (
            <div className="glass-panel flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <Settings2 className="w-12 h-12 mb-4 opacity-50" />
              <h3 className="text-white font-semibold text-lg">No Clip Selected</h3>
              <p className="mt-2 text-sm max-w-sm mx-auto">
                Select a clip from the left sidebar to generate optimized metadata and queue it for
                publishing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
