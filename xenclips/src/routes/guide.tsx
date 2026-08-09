import { createFileRoute } from "@tanstack/react-router";
import {
  Key,
  Upload,
  Scissors,
  Captions,
  Download,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Zap,
  Play,
  FileVideo,
  Youtube,
  ChevronRight,
} from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Key,
    color: "#00F0FF",
    title: "Add Your Gemini API Key",
    desc: "XenClips uses Google Gemini AI to detect viral moments. You need at least one free API key.",
    steps: [
      "Go to Settings → AI Engine (Gemini)",
      "Paste your Gemini API key into the key field and click +",
      'You can add multiple keys — XenClips rotates them automatically to stay within free-tier limits',
      'Set "Requests per key" to 50 (recommended for free tier)',
      'Select your model — "Gemini 2.5 Flash" is the best balance of speed and quality',
      "Click Save Settings",
    ],
    tip: 'Get a free key at console.cloud.google.com → APIs & Services → Credentials, or via ai.google.dev. The free tier gives ~1500 requests/day per key.',
  },
  {
    num: "02",
    icon: FileVideo,
    color: "#8A2BE2",
    title: "Upload Your Video",
    desc: "Paste a YouTube link or drop a local video file onto the upload zone.",
    steps: [
      "On the Upload page, choose YouTube Link or Local File",
      "Paste a YouTube URL or drag-and-drop your MP4/MOV file",
      "Local files are processed entirely on your machine — nothing is uploaded to any server",
    ],
    tip: "Longer videos (20–60 min) give better results since the AI has more moments to choose from.",
  },
  {
    num: "03",
    icon: Settings,
    color: "#00F0FF",
    title: "Configure Your Settings",
    desc: "Tune the generation settings to match your content style.",
    steps: [
      "Number of Clips — how many short clips to extract (default: 5)",
      "Layout — choose Cinematic (16:9 blur), Aura Blur, Streamer split, or Raw Format",
      "Captions — toggle on and pick a caption style (Alex Hormozi, MrBeast, Podcast, etc.)",
      "AI Vibe — set the Clip Selection Theme (e.g. Podcast, Gaming, Motivation) so the AI picks the right moments",
      "Hook Style — pick how the AI writes the hook text overlay",
    ],
    tip: "The 'Alex Hormozi' caption style works great for motivational/business content. 'Podcast' works for interviews.",
  },
  {
    num: "04",
    icon: Zap,
    color: "#8A2BE2",
    title: "Generate Clips",
    desc: "Hit Generate and let the AI engine do the heavy lifting.",
    steps: [
      "Click the Generate button at the bottom of the form",
      "The progress tracker shows each stage: Download → Transcribe → Select Clips → Render",
      "Transcription uses Faster-Whisper large-v3-turbo (local, offline, no GPU needed)",
      "Auto language detection runs first — supports English, Hindi, and Hinglish (Roman script output)",
      "Clip selection is powered by Gemini AI — it reads the transcript and picks the best moments",
      "Rendering runs locally using FFmpeg — no cloud processing needed",
    ],
    tip: "Faster-Whisper large-v3-turbo on CPU (int8) typically takes 30–90 seconds per clip for transcription. A 1-hour video split into 5 clips takes roughly 3–8 minutes total depending on your CPU.",
  },
  {
    num: "05",
    icon: Scissors,
    color: "#00F0FF",
    title: "Review & Edit Clips",
    desc: "Preview each clip, make post-generation edits, and re-export individual clips.",
    steps: [
      "Click 'Review Clips' when generation completes, or go to the Clips tab",
      "Click any clip card to open the editor",
      "In the editor you can change the caption style, layout, hook text, and more",
      "Click 'Save & Re-Export' to render only that clip with the new settings",
      "Use the video player preview to check timing and visuals",
    ],
    tip: "Re-exporting a single clip is fast — usually under 30 seconds. You don't need to regenerate all clips.",
  },
  {
    num: "06",
    icon: Download,
    color: "#8A2BE2",
    title: "Export & Use Your Clips",
    desc: "Download the final MP4 files and upload them directly to your platforms.",
    steps: [
      "In the Clips tab, click the Download button on any clip card",
      "Files are saved to your local machine as MP4 (H.264, AAC audio)",
      "Clips are pre-formatted for Instagram Reels, YouTube Shorts, and TikTok (9:16)",
      "The History tab keeps a log of all past jobs for reference",
    ],
    tip: "Clips are stored in the output folder inside your XenClips directory. Check Settings → Backend URL if you need to find it.",
  },
];

const faqs = [
  {
    q: "Why is my video taking so long to process?",
    a: "XenClips uses Faster-Whisper large-v3-turbo on CPU (int8). Each ~60 second clip typically takes 30–90 seconds to transcribe. For 5 clips from a 1-hour video expect 3–8 minutes total. A faster CPU makes a direct difference.",
  },
  {
    q: "I'm hitting Gemini API rate limits. What do I do?",
    a: 'Add more API keys in Settings → AI Engine. XenClips rotates them automatically. You can get multiple free keys by creating different Google Cloud projects.',
  },
  {
    q: "The app says 'Backend offline'. What do I do?",
    a: "The Python backend (FastAPI server) needs to be running. Make sure you started both the backend (python server.py) and the frontend (npm run dev) as per the setup instructions.",
  },
  {
    q: "Can I use this on any video?",
    a: "Any video with speech works well. Music-only videos or silent content won't produce good results since the AI relies on transcription to find viral moments.",
  },
  {
    q: "Where are my generated clips saved?",
    a: "Clips are saved to the output/ folder inside your XenClips installation directory on your local machine.",
  },
];

function HowToUsePage() {
  return (
    <div className="min-h-full p-8 md:p-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}
          >
            <Play className="w-5 h-5" style={{ color: "#00F0FF", filter: "drop-shadow(0 0 8px rgba(0,240,255,0.5))" }} />
          </div>
          <div>
            <div
              className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
              style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}
            >
              HOW TO USE
            </div>
            <div style={{ fontSize: 10, color: "#8A2BE2", letterSpacing: "0.18em", fontWeight: 700 }}>
              XENCLIPS GUIDE
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.55)", maxWidth: 560 }}>
          From zero to your first viral clip in under 10 minutes. Follow the steps below to get XenClips set up and generating your first shorts.
        </p>
        <div
          style={{ height: 1, marginTop: 20, background: "linear-gradient(90deg, rgba(0,240,255,0.3), rgba(138,43,226,0.3), transparent)" }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-6 mb-14">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Step header */}
              <div
                className="flex items-center gap-4 px-6 py-4"
                style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `rgba(${step.color === "#00F0FF" ? "0,240,255" : "138,43,226"},0.1)`,
                    border: `1px solid rgba(${step.color === "#00F0FF" ? "0,240,255" : "138,43,226"},0.25)`,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: step.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 11, color: step.color, fontWeight: 700, letterSpacing: "0.1em" }}>
                      STEP {step.num}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                    {step.title}
                  </div>
                </div>
              </div>

              {/* Step body */}
              <div className="px-6 py-5">
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
                  {step.desc}
                </p>
                <div className="space-y-2 mb-4">
                  {step.steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" style={{ color: step.color, opacity: 0.7 }} />
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>{s}</span>
                    </div>
                  ))}
                </div>
                {/* Tip */}
                <div
                  className="flex items-start gap-3 rounded-xl px-4 py-3 mt-4"
                  style={{
                    background: `rgba(${step.color === "#00F0FF" ? "0,240,255" : "138,43,226"},0.05)`,
                    border: `1px solid rgba(${step.color === "#00F0FF" ? "0,240,255" : "138,43,226"},0.15)`,
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: step.color }} />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                    <strong style={{ color: step.color }}>Tip: </strong>{step.tip}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* API Key Quick Guide */}
      <section className="mb-14">
        <h2
          className="font-display mb-5"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          Getting a Free Gemini API Key
        </h2>
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { num: "1", text: "Visit ai.google.dev and sign in with your Google account" },
              { num: "2", text: 'Click "Get API Key" → "Create API key in new project"' },
              { num: "3", text: "Copy the key and paste it into XenClips Settings → AI Engine" },
            ].map((item) => (
              <div
                key={item.num}
                className="rounded-xl p-4 text-center"
                style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.12)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3 font-bold font-display"
                  style={{ background: "rgba(0,240,255,0.1)", color: "#00F0FF", fontSize: 14 }}
                >
                  {item.num}
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{item.text}</p>
              </div>
            ))}
          </div>
          <div
            className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "rgba(255,165,0,0.05)", border: "1px solid rgba(255,165,0,0.15)" }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#FFA500]" />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              <strong style={{ color: "#FFA500" }}>Free tier limit: </strong>
              The Gemini 2.5 Flash free tier allows ~1500 requests/day per key. For heavy use, add multiple keys from different Google accounts. XenClips rotates them automatically.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2
          className="font-display mb-5"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          Common Questions
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-display"
                  style={{ background: "rgba(138,43,226,0.15)", color: "#8A2BE2", border: "1px solid rgba(138,43,226,0.25)" }}
                >
                  ?
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{faq.q}</p>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", paddingLeft: 32 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div
        className="text-center py-6 rounded-2xl"
        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2]"
          style={{ fontSize: 18, fontWeight: 800 }}
        >
          Ready to clip?
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
          Head to Upload and paste your first video.
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/guide")({
  component: HowToUsePage,
});
