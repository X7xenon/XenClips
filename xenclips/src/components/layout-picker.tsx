import { cn } from "@/lib/utils";
import type { LayoutTemplate } from "@/lib/api";
import { CheckCircle2 } from "lucide-react";

const OPTIONS: {
  key: LayoutTemplate;
  label: string;
  hint: string;
  aspect: "vertical" | "wide";
  thumb: React.ReactNode;
}[] = [
  {
    key: "full_vertical",
    label: "Vertical AI",
    hint: "Smart YOLO + face crop",
    aspect: "vertical",
    thumb: (
      <div
        className="h-full w-full relative"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,25,1) 0%, rgba(10,10,15,1) 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
        <div
          style={{
            position: "absolute",
            inset: "25%",
            border: "1px solid rgba(0,240,255,0.4)",
            borderRadius: 6,
            boxShadow: "0 0 10px rgba(0,240,255,0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "30%",
            right: "30%",
            height: 1,
            background: "rgba(0,240,255,0.6)",
            boxShadow: "0 0 5px rgba(0,240,255,1)",
          }}
        />
      </div>
    ),
  },
  {
    key: "bw_letterbox",
    label: "Cinematic",
    hint: "Original ratio + black bars",
    aspect: "vertical",
    thumb: (
      <div className="flex flex-col h-full w-full bg-black">
        <div style={{ flex: "0 0 20%", background: "#000" }} />
        <div
          style={{
            flex: 1,
            background: "linear-gradient(135deg, rgba(40,40,45,1) 0%, rgba(20,20,25,1) 100%)",
          }}
        />
        <div style={{ flex: "0 0 20%", background: "#000" }} />
      </div>
    ),
  },
  {
    key: "blur_bg",
    label: "Aura Blur",
    hint: "Blur fill behind video",
    aspect: "vertical",
    thumb: (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          background: "linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(138,43,226,0.2) 100%)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(4px)" }} />
        <div
          style={{
            position: "absolute",
            top: "20%",
            bottom: "20%",
            left: 0,
            right: 0,
            background: "linear-gradient(135deg, rgba(30,30,35,1) 0%, rgba(15,15,20,1) 100%)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    ),
  },
  {
    key: "streamer",
    label: "Streamer",
    hint: "9:16 padded with white canvas",
    aspect: "vertical",
    thumb: (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "56.25%", // 16:9 aspect inside 9:16 wrapper
            background:
              "linear-gradient(135deg, rgba(138,43,226,0.8) 0%, rgba(0,240,255,0.8) 100%)",
          }}
        />
      </div>
    ),
  },
  {
    key: "original",
    label: "Raw Format",
    hint: "No crop, native ratio",
    aspect: "wide",
    thumb: (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          background: "rgba(10,10,15,1)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "50%",
            background: "linear-gradient(135deg, rgba(30,30,35,1) 0%, rgba(20,20,25,1) 100%)",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        />
      </div>
    ),
  },
  {
    key: "vertical_no_tracking",
    label: "Vertical",
    hint: "9:16 Scale, no tracking",
    aspect: "vertical",
    thumb: (
      <div className="h-full w-full relative bg-[#0a0a0f] flex items-center justify-center">
        <div
          style={{
            width: "80%",
            height: "45%",
            background: "linear-gradient(135deg, rgba(30,30,35,1) 0%, rgba(20,20,25,1) 100%)",
            border: "1px solid rgba(0,240,255,0.4)",
            borderRadius: 4,
            boxShadow: "0 0 10px rgba(0,240,255,0.1)",
          }}
        />
      </div>
    ),
  },
];

export function LayoutPicker({
  value,
  onChange,
  singleSelect = false,
}: {
  value: LayoutTemplate[];
  onChange: (v: LayoutTemplate[]) => void;
  singleSelect?: boolean;
}) {
  const toggle = (k: LayoutTemplate) => {
    if (singleSelect) {
      onChange([k]);
      return;
    }
    if (value.includes(k)) {
      if (value.length <= 1) return;
      onChange(value.filter((v) => v !== k));
    } else {
      onChange([...value, k]);
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      {OPTIONS.map((opt) => {
        const active = value.includes(opt.key);
        const isVertical = opt.aspect === "vertical";
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => toggle(opt.key)}
            aria-pressed={active}
            className={cn(
              "relative overflow-hidden text-left rounded-xl transition-all duration-300 group",
              active
                ? "shadow-[0_4px_20px_rgba(0,240,255,0.2)]"
                : "hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:-translate-y-1",
            )}
            style={{
              width: isVertical ? 86 : 120,
              height: isVertical ? 120 : 86,
              padding: 0,
              border: `1px solid ${active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              flexShrink: 0,
              background: "rgba(20,20,25,0.6)",
            }}
          >
            {/* Active Glow Ring */}
            {active && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] p-[1px] -z-10" />
            )}

            {/* Thumbnail */}
            <div className="absolute inset-0 overflow-hidden rounded-xl">{opt.thumb}</div>

            {/* Active Checkmark */}
            {active && (
              <div className="absolute top-2 right-2 bg-[rgba(0,240,255,0.15)] backdrop-blur-md rounded-full border border-[rgba(0,240,255,0.4)]">
                <CheckCircle2 className="w-4 h-4 text-[#00F0FF]" />
              </div>
            )}

            {/* Label strip */}
            <div
              className="absolute inset-x-0 bottom-0 px-2 py-1.5 backdrop-blur-md transition-colors duration-300"
              style={{
                background: active ? "rgba(0,240,255,0.15)" : "rgba(10,10,15,0.85)",
                borderTop: `1px solid ${active ? "rgba(0,240,255,0.3)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <div
                className="font-display truncate"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                }}
              >
                {opt.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
