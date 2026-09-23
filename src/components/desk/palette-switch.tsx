"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

export const PALETTES = [
  { id: "ink", label: "Ink", swatch: "oklch(0.14 0.03 260)" },
  { id: "bone", label: "Bone", swatch: "oklch(0.94 0.02 85)" },
  { id: "claret", label: "Claret", swatch: "oklch(0.28 0.09 18)" },
  { id: "gallery", label: "Gallery", swatch: "oklch(0.9 0.02 85)" },
  { id: "sea", label: "Sea", swatch: "oklch(0.28 0.06 155)" },
  { id: "plum", label: "Plum", swatch: "oklch(0.26 0.07 325)" },
  { id: "copper", label: "Copper", swatch: "oklch(0.42 0.12 50)" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

const KEY = "ec-palette";
const FALLBACK: PaletteId = "ink";

function isPalette(id: string | undefined): id is PaletteId {
  return PALETTES.some((p) => p.id === id);
}

function apply(id: PaletteId) {
  document.documentElement.dataset.palette = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function PaletteSwitch() {
  const [id, setId] = useState<PaletteId>(FALLBACK);

  useEffect(() => {
    const saved = document.documentElement.dataset.palette;
    if (isPalette(saved)) setId(saved);
    else apply(FALLBACK);
  }, []);

  return (
    <div className="flex items-center gap-1.5 pr-2" title="Colour">
      {PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={p.label}
          title={p.label}
          onClick={() => {
            setId(p.id);
            apply(p.id);
          }}
          className={cn(
            "size-4 rounded-full border",
            id === p.id ? "border-foreground ring-foreground/50 ring-2" : "border-white/25 opacity-90 hover:opacity-100",
          )}
          style={{ background: p.swatch }}
        />
      ))}
    </div>
  );
}
