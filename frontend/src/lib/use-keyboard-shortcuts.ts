import { useEffect } from "react";

type ShortcutHandler = () => void;

type Shortcuts = Record<string, ShortcutHandler>;

/**
 * Registers global keyboard shortcuts. Ignores events from input/textarea/select elements.
 * Keys: "/" for search, "n" for new card, "Escape" always fires.
 */
export const useKeyboardShortcuts = (shortcuts: Shortcuts) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Escape always fires
      if (event.key === "Escape" && shortcuts["Escape"]) {
        shortcuts["Escape"]();
        return;
      }

      // Other shortcuts only fire outside inputs
      if (isInput) return;

      const fn = shortcuts[event.key];
      if (fn) {
        event.preventDefault();
        fn();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
};
