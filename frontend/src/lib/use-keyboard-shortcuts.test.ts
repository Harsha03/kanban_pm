import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  it("calls handler for registered key", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ n: handler }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire for unregistered keys", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ n: handler }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys from input elements", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ n: handler }));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("fires Escape even from input elements", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ Escape: handler }));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });
});
