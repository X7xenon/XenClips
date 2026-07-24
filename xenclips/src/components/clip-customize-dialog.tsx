import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipSettingsForm } from "@/components/clip-settings-form";
import type { ClipSettings } from "@/lib/api";

export function ClipCustomizeDialog({
  open,
  onOpenChange,
  initial,
  clipTitle,
  onSave,
  onReset,
  isCustom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ClipSettings;
  clipTitle: string;
  isCustom: boolean;
  onSave: (s: ClipSettings) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<ClipSettings>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Customize clip</DialogTitle>
          <DialogDescription className="line-clamp-1">{clipTitle}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ClipSettingsForm
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            showHookText
          />
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <div>
            {isCustom && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onReset();
                  onOpenChange(false);
                }}
              >
                Reset to bulk defaults
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
