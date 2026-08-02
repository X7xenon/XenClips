import { useState, useEffect, useCallback } from "react";

export type ShortcutConfig = {
  toggleSidebar: string;
  interruptProcessing: string;
  submitJob: string;
  navigateHome: string;
};

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  toggleSidebar: "b",
  interruptProcessing: "k",
  submitJob: "Enter",
  navigateHome: "h",
};

export function getShortcuts(): ShortcutConfig {
  if (typeof window === "undefined") return DEFAULT_SHORTCUTS;
  try {
    const saved = localStorage.getItem("clipper.shortcuts");
    if (saved) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to parse shortcuts", e);
  }
  return DEFAULT_SHORTCUTS;
}

export function saveShortcuts(config: ShortcutConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem("clipper.shortcuts", JSON.stringify(config));
  // Dispatch a custom event so other components can update
  window.dispatchEvent(new Event("shortcutsUpdated"));
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>(getShortcuts());

  useEffect(() => {
    const handleUpdate = () => setShortcuts(getShortcuts());
    window.addEventListener("shortcutsUpdated", handleUpdate);
    return () => window.removeEventListener("shortcutsUpdated", handleUpdate);
  }, []);

  // Helper to check if a KeyboardEvent matches a specific shortcut action
  const matchesShortcut = useCallback(
    (e: KeyboardEvent, action: keyof ShortcutConfig) => {
      const key = shortcuts[action].toLowerCase();
      const pressedKey = e.key.toLowerCase();

      // We assume all shortcuts require Ctrl or Meta (Cmd) for safety,
      // except maybe "Enter" which we might allow as Ctrl+Enter.
      if (!(e.ctrlKey || e.metaKey)) return false;

      return pressedKey === key;
    },
    [shortcuts],
  );

  return { shortcuts, setShortcuts: saveShortcuts, matchesShortcut };
}
