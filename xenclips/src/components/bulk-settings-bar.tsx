import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipSettingsForm } from "@/components/clip-settings-form";
import { Wand2 } from "lucide-react";
import type { ClipSettings } from "@/lib/api";

export function BulkSettingsBar({
  value,
  onChange,
  customizedCount,
  onApplyAll,
}: {
  value: ClipSettings;
  onChange: (patch: Partial<ClipSettings>) => void;
  customizedCount: number;
  onApplyAll: (overwriteCustom: boolean) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleApply = () => {
    if (customizedCount > 0) setConfirmOpen(true);
    else onApplyAll(true);
  };

  return (
    <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Bulk Settings</div>
          <div className="text-xs text-muted-foreground">
            Defaults applied to every clip that hasn't been individually customized.
          </div>
        </div>
        <Button onClick={handleApply} className="gap-1">
          <Wand2 className="h-4 w-4" />
          Apply to All Clips
        </Button>
      </div>

      <ClipSettingsForm value={value} onChange={onChange} showHookText={false} dense />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite customized clips?</AlertDialogTitle>
            <AlertDialogDescription>
              {customizedCount} clip{customizedCount === 1 ? " has" : "s have"} custom settings. Do
              you want to overwrite them too?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmOpen(false);
                onApplyAll(false);
              }}
            >
              No, keep custom
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onApplyAll(true);
              }}
            >
              Yes, overwrite all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
