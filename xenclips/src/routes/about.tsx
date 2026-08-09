import { createFileRoute } from "@tanstack/react-router";
import { Instagram, Youtube, Scissors, Zap, FileText, Lock, Cloud, Rocket, Wrench } from "lucide-react";

const features = [
  { icon: Zap, label: "AI-powered clip generation" },
  { icon: Scissors, label: "Automated short-form workflow" },
  { icon: FileText, label: "AI captions & subtitles" },
  { icon: Lock, label: "Local-first & privacy focused" },
  { icon: Cloud, label: "No mandatory cloud processing" },
  { icon: Rocket, label: "Built for creators, editors & content teams" },
  { icon: Wrench, label: "Continuously evolving through real-world use" },
];

function AboutPage() {
  return (
    <div className="min-h-full p-8 md:p-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{
              background: "rgba(0,240,255,0.08)",
              border: "1px solid rgba(0,240,255,0.2)",
            }}
          >
            <Scissors className="w-5 h-5" style={{ color: "#00F0FF", filter: "drop-shadow(0 0 8px rgba(0,240,255,0.5))" }} />
          </div>
          <div>
            <div
              className="font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
              style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}
            >
              XENCLIPS
            </div>
            <div style={{ fontSize: 10, color: "#8A2BE2", letterSpacing: "0.18em", fontWeight: 700 }}>
              BY XENON
            </div>
          </div>
        </div>
        <div
          style={{ height: 1, background: "linear-gradient(90deg, rgba(0,240,255,0.3), rgba(138,43,226,0.3), transparent)" }}
        />
      </div>

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
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
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

        <div
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Avatar + name */}
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
              <div
                className="font-display"
                style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}
              >
                Abeer Kumar
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                Engineer · Creator · Builder
              </div>
            </div>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            XenClips was created by <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Abeer Kumar</span> — an
            aspiring polymath, engineer, and creator fascinated by the intersection of AI, software, filmmaking, and creative
            technology.
          </p>
          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            The idea started with a simple problem: editing clips manually was taking too much time. Instead of looking for
            another tool, Abeer decided to build one.
          </p>
          <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
            What started as a personal solution is now evolving into XenClips — an experiment in building powerful creative
            software from the ground up.
          </p>

          {/* Philosophy */}
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
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
            }}
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
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              textDecoration: "none",
            }}
          >
            <Youtube className="w-5 h-5" style={{ color: "#FF0000" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>YouTube</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@theabeerkumar</div>
            </div>
          </a>
        </div>
      </section>

      {/* Footer tagline */}
      <div
        className="text-center py-6 mt-6 rounded-2xl"
        style={{
          background: "rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
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

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
