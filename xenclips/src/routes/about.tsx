import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Instagram,
  Youtube,
  Scissors,
  Zap,
  FileText,
  Lock,
  Cloud,
  Rocket,
  Wrench,
  Check,
  X,
  Crown,
  Info,
} from "lucide-react";

const features = [
  { icon: Zap, label: "AI-powered clip generation" },
  { icon: Scissors, label: "Automated short-form workflow" },
  { icon: FileText, label: "AI captions & subtitles" },
  { icon: Lock, label: "Local-first & privacy focused" },
  { icon: Cloud, label: "No mandatory cloud processing" },
  { icon: Rocket, label: "Built for creators, editors & content teams" },
  { icon: Wrench, label: "Continuously evolving through real-world use" },
];

const compareRows = [
  {
    category: "Core Clipping",
    rows: [
      { feature: "AI Clip Selection (Gemini)", free: true, pro: true },
      { feature: "Local Video Upload", free: true, pro: true },
      { feature: "YouTube URL Download", free: true, pro: true },
      { feature: "Number of Clips per Job", free: "Up to 6", pro: "Up to 15" },
      { feature: "Max Video Length", free: "~60 min", pro: "No limit" },
    ],
  },
  {
    category: "Captions & Subtitles",
    rows: [
      { feature: "AI Captions (Whisper)", free: true, pro: true },
      { feature: "Caption Styles (Hormozi, MrBeast, etc.)", free: "3 styles", pro: "All styles" },
      { feature: "Font Size & Position Control", free: false, pro: true },
      { feature: "Max Words per Line Control", free: false, pro: true },
      { feature: "Hinglish / Roman Script Output", free: true, pro: true },
    ],
  },
  {
    category: "Video Layouts",
    rows: [
      { feature: "Full Vertical (9:16)", free: true, pro: true },
      { feature: "Cinematic Blur Split", free: true, pro: true },
      { feature: "Aura Blur Layout", free: true, pro: true },
      { feature: "Streamer Split Layout", free: true, pro: true },
      { feature: "Raw Format", free: true, pro: true },
    ],
  },
  {
    category: "Anti-Copyright",
    rows: [
      { feature: "Mirror Video", free: false, pro: true },
      { feature: "Speed Adjustment (1.0×–1.2×)", free: false, pro: true },
      { feature: "Crop / Zoom Slider (1.0×–1.5×)", free: false, pro: true },
      { feature: "Pitch-Shift Audio (rubberband)", free: false, pro: true },
    ],
  },
  {
    category: "Sound Effects",
    rows: [
      { feature: "SFX Engine (Whoosh, Impact, etc.)", free: false, pro: true },
      { feature: "SFX Volume Control", free: false, pro: true },
      { feature: "SFX Pack Selector", free: false, pro: true },
      { feature: "Keyword-triggered SFX", free: false, pro: true },
    ],
  },
  {
    category: "Publish & Export",
    rows: [
      { feature: "Download MP4 Clips", free: true, pro: true },
      { feature: "Publish Center (AI Metadata)", free: false, pro: true },
      { feature: "AI Title & Caption Generator", free: false, pro: true },
      { feature: "Hashtag Generator (15–20 tags)", free: false, pro: true },
      { feature: "Upload Queue", free: false, pro: true },
    ],
  },
  {
    category: "UI & Workflow",
    rows: [
      { feature: "Clip Editor & Re-export", free: true, pro: true },
      { feature: "Watermark Support", free: false, pro: true },
      { feature: "Fade In/Out on Clips", free: false, pro: true },
      { feature: "History Tab", free: true, pro: true },
      { feature: "Smart Zoom / Speed Ramp", free: false, pro: true },
      { feature: "Preset Save / Load", free: false, pro: true },
    ],
  },
];

function AboutTab() {
  return (
    <div>
      {/* What is XenClips */}
      <section className="mb-10">
        <h2
          className="font-display mb-4"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          About XenClips
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.65)" }}>
          XenClips is a <span style={{ color: "#00F0FF", fontWeight: 600 }}>local-first AI clipping software</span> built
          for creators who want to turn long-form content into engaging short-form videos — faster.
        </p>
        <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.65)" }}>
          It automates the repetitive parts of short-form editing: finding interesting moments, generating captions,
          formatting clips, and preparing content for platforms like Instagram Reels and YouTube Shorts.
        </p>
      </section>

      {/* Why XenClips */}
      <section className="mb-10">
        <h2
          className="font-display mb-5"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          Why XenClips?
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                style={{ background: "rgba(0,240,255,0.07)", border: "1px solid rgba(0,240,255,0.15)" }}
              >
                <Icon className="w-4 h-4" style={{ color: "#00F0FF" }} />
              </div>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Creator Section */}
      <section className="mb-10">
        <h2
          className="font-display mb-4"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          The Mind Behind XenClips
        </h2>
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(138,43,226,0.15) 100%)",
                border: "1px solid rgba(138,43,226,0.3)",
                color: "#00F0FF",
              }}
            >
              A
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                Abeer Kumar
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Engineer · Creator · Builder
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            XenClips was created by <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Abeer Kumar</span> — an
            aspiring polymath, engineer, and creator fascinated by the intersection of AI, software, filmmaking, and creative technology.
          </p>
          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            The idea started with a simple problem: editing clips manually was taking too much time. Instead of looking for
            another tool, Abeer decided to build one.
          </p>
          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            What started as a personal solution is now evolving into XenClips Pro — an experiment in building powerful creative
            software from the ground up.
          </p>
          <div
            className="mt-5 rounded-xl px-5 py-4"
            style={{
              background: "linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(138,43,226,0.05) 100%)",
              border: "1px solid rgba(138,43,226,0.2)",
            }}
          >
            <p
              className="font-display text-center"
              style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}
            >
              "Don't just consume technology. Build it."
            </p>
          </div>
        </div>
      </section>

      {/* Follow */}
      <section className="mb-10">
        <h2
          className="font-display mb-5"
          style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.05em" }}
        >
          Follow the Journey
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://instagram.com/theabeerkumar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none" }}
          >
            <Instagram className="w-5 h-5" style={{ color: "#E1306C" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Instagram</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@theabeerkumar</div>
            </div>
          </a>
          <a
            href="https://youtube.com/@theabeerkumar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none" }}
          >
            <Youtube className="w-5 h-5" style={{ color: "#FF0000" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>YouTube</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@theabeerkumar</div>
            </div>
          </a>
        </div>
      </section>

      {/* Footer */}
      <div className="text-center py-6 mt-6 rounded-2xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div
          className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2]"
          style={{ fontSize: 22, fontWeight: 800 }}
        >
          XenClips
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6, fontStyle: "italic" }}>
          Build less workflow. Create more.
        </div>
      </div>
    </div>
  );
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="w-4 h-4 mx-auto" style={{ color: "#00F0FF" }} />;
  if (value === false)
    return <X className="w-4 h-4 mx-auto" style={{ color: "rgba(255,255,255,0.18)" }} />;
  return <span style={{ fontSize: 12, color: "#00F0FF", fontWeight: 600 }}>{value}</span>;
}

function CompareTab() {
  return (
    <div>
      {/* Hero banner */}
      <div
        className="rounded-2xl p-6 mb-8 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,240,255,0.06) 0%, rgba(138,43,226,0.10) 100%)",
          border: "1px solid rgba(138,43,226,0.25)",
        }}
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl" style={{ background: "rgba(138,43,226,0.12)" }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(138,43,226,0.15)", border: "1px solid rgba(138,43,226,0.3)" }}
          >
            <Crown className="w-6 h-6" style={{ color: "#8A2BE2" }} />
          </div>
          <div>
            <div className="font-display text-white font-bold text-lg">XenClips Free vs Pro</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
              You're using <span style={{ color: "#00F0FF", fontWeight: 600 }}>XenClips Pro</span> — every feature below is unlocked.
            </div>
          </div>
        </div>
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[1fr_90px_90px] gap-2 mb-3 px-2">
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Feature</div>
        <div className="text-center" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Free</div>
        <div className="text-center" style={{ fontSize: 11, color: "#00F0FF", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Pro</div>
      </div>

      {/* Comparison table */}
      <div className="space-y-6">
        {compareRows.map((section) => (
          <div key={section.category}>
            {/* Category label */}
            <div
              className="px-3 py-1.5 rounded-lg mb-2 inline-block"
              style={{ background: "rgba(138,43,226,0.08)", border: "1px solid rgba(138,43,226,0.2)" }}
            >
              <span style={{ fontSize: 11, color: "#8A2BE2", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {section.category}
              </span>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {section.rows.map((row, i) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[1fr_90px_90px] items-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{row.feature}</span>
                  <div className="text-center">
                    <Cell value={row.free} />
                  </div>
                  <div
                    className="text-center rounded-md py-0.5"
                    style={
                      row.pro === true
                        ? { background: "rgba(0,240,255,0.06)", border: "1px solid rgba(0,240,255,0.12)" }
                        : undefined
                    }
                  >
                    <Cell value={row.pro} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div
        className="mt-8 rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.15)" }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#00F0FF" }} />
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          XenClips Free (v0.7) is the open-source baseline. XenClips Pro is the actively developed version with advanced anti-copyright tools, the full SFX engine, Publish Center, and premium UI features.
        </p>
      </div>
    </div>
  );
}

function AboutPage() {
  const [tab, setTab] = useState<"about" | "compare">("about");

  return (
    <div className="min-h-full p-8 md:p-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}
          >
            <Scissors className="w-5 h-5" style={{ color: "#00F0FF", filter: "drop-shadow(0 0 8px rgba(0,240,255,0.5))" }} />
          </div>
          <div>
            <div
              className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
              style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}
            >
              XENCLIPS PRO
            </div>
            <div style={{ fontSize: 10, color: "#00F0FF", letterSpacing: "0.18em", fontWeight: 700 }}>
              BY XENON
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(0,240,255,0.3), rgba(138,43,226,0.3), transparent)" }} />
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 mb-8 p-1 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}
      >
        {([
          { key: "about", label: "About" },
          { key: "compare", label: "Free vs Pro" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={
              tab === key
                ? {
                    background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(138,43,226,0.15))",
                    border: "1px solid rgba(0,240,255,0.25)",
                    color: "#fff",
                  }
                : {
                    border: "1px solid transparent",
                    color: "rgba(255,255,255,0.45)",
                  }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "about" ? <AboutTab /> : <CompareTab />}
    </div>
  );
}

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
