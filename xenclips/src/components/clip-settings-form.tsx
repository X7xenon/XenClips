import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CaptionPosition, CaptionTemplate, ClipSettings, LayoutTemplate } from "@/lib/api";

const TEMPLATES: { value: CaptionTemplate; label: string }[] = [
  { value: "alex_hormozi", label: "Alex Hormozi" },
  { value: "mrbeast", label: "MrBeast" },
  { value: "iman_gadzhi", label: "Iman Gadzhi" },
  { value: "ali_abdaal", label: "Ali Abdaal" },
  { value: "podcast", label: "Podcast" },
  { value: "gaming", label: "Gaming" },
  { value: "motivational", label: "Motivational" },
  { value: "minimal_clean", label: "Minimal Clean" },
  { value: "tiktok_viral", label: "TikTok Viral" },
  { value: "premium_cinematic", label: "Premium Cinematic" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "hacker", label: "Hacker Terminal" },
  { value: "dreamy", label: "Dreamy Cloud" },
  { value: "news_flash", label: "News Flash" },
  { value: "y2k_bubbly", label: "Y2K Bubbly" },
  { value: "comic_book", label: "Comic Book" },
  { value: "typewriter", label: "Typewriter" },
  { value: "liquid_glass", label: "Liquid Glass" },
  { value: "blueprint", label: "Blueprint" },
  { value: "street_graffiti", label: "Street Graffiti" },
  { value: "luxury_marble", label: "Luxury Marble" },
  { value: "comic_manga", label: "Comic Manga" },
  { value: "holographic", label: "Holographic" },
  { value: "old_newspaper", label: "Old Newspaper" },
  { value: "blueprint_hud", label: "Blueprint HUD" },
];

const LAYOUTS: { value: LayoutTemplate; label: string }[] = [
  { value: "full_vertical", label: "Full Vertical" },
  { value: "bw_letterbox", label: "B&W Letterbox" },
  { value: "blur_bg", label: "Blur Background" },
];

export function ClipSettingsForm({
  value,
  onChange,
  showHookText = true,
  dense = false,
}: {
  value: ClipSettings;
  onChange: (patch: Partial<ClipSettings>) => void;
  showHookText?: boolean;
  dense?: boolean;
}) {
  const gap = dense ? "gap-3" : "gap-4";
  return (
    <div className={`flex flex-wrap items-start ${gap}`}>
      <Field label="Template" className="w-40">
        <Select
          value={value.template}
          onValueChange={(v) => onChange({ template: v as CaptionTemplate })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Position" className="w-40">
        <Tabs
          value={value.position}
          onValueChange={(v) => onChange({ position: v as CaptionPosition })}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="top">Top</TabsTrigger>
            <TabsTrigger value="center">Center</TabsTrigger>
            <TabsTrigger value="bottom">Bottom</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>

      <Field label="Layout" className="w-44">
        <Select
          value={value.layout}
          onValueChange={(v) => onChange({ layout: v as LayoutTemplate })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYOUTS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Hook Text" className="w-32">
        <div className="flex h-9 items-center">
          <Switch
            checked={value.hook_text_enabled}
            onCheckedChange={(c) => onChange({ hook_text_enabled: c })}
          />
          <span className="ml-2 text-xs text-muted-foreground">
            {value.hook_text_enabled ? "On" : "Off"}
          </span>
        </div>
      </Field>

      {showHookText && value.hook_text_enabled && (
        <Field label="Hook Text (editable)" className="min-w-[220px] flex-1">
          <Input
            value={value.hook_text}
            onChange={(e) => onChange({ hook_text: e.target.value })}
            placeholder="Attention-grabbing headline…"
          />
        </Field>
      )}

      <Field label="Fade In/Out" className="w-40">
        <div className="flex h-9 items-center gap-2">
          <Switch
            checked={value.fade_in > 0 || value.fade_out > 0}
            onCheckedChange={(c) => onChange({ fade_in: c ? 0.3 : 0, fade_out: c ? 0.3 : 0 })}
          />
          <Input
            type="number"
            step="0.1"
            min="0"
            value={value.fade_in}
            onChange={(e) => onChange({ fade_in: Number(e.target.value) })}
            className="h-8 w-14"
          />
          <span className="text-xs text-muted-foreground">/</span>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={value.fade_out}
            onChange={(e) => onChange({ fade_out: Number(e.target.value) })}
            className="h-8 w-14"
          />
        </div>
      </Field>

      <Field label="Zoom Punch" className="w-28">
        <div className="flex h-9 items-center">
          <Switch checked={value.zoom_punch} onCheckedChange={(c) => onChange({ zoom_punch: c })} />
          <span className="ml-2 text-xs text-muted-foreground">
            {value.zoom_punch ? "On" : "Off"}
          </span>
        </div>
      </Field>

      <Field label="Face Tracking" className="w-40">
        <div>
          <div className="flex h-9 items-center">
            <Switch
              checked={value.face_tracking}
              onCheckedChange={(c) => onChange({ face_tracking: c })}
            />
            <span className="ml-2 text-xs text-muted-foreground">
              {value.face_tracking ? "On" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
            Slower on CPU-only machines
          </p>
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
