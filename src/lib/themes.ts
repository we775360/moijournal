import type { Theme } from "./session";

export type ThemeOption = { id: Theme; name: string; swatch: string; note: string };

// The swatches mirror the `[data-theme]` blocks in styles.css — keep the two in step.
export const THEMES: ThemeOption[] = [
  { id: "blush", name: "Blush", swatch: "#f2b8c0", note: "soft & rosy" },
  { id: "sage", name: "Sage", swatch: "#b9dcc0", note: "calm & leafy" },
  { id: "sky", name: "Sky", swatch: "#b6d4ee", note: "breezy & blue" },
  { id: "butter", name: "Butter", swatch: "#f6e3a1", note: "sunny & warm" },
  { id: "midnight", name: "Midnight", swatch: "#3a3352", note: "cosy & dark" },
];
