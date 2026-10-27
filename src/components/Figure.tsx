"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { emptyMask, LEVELS, useFigureImage } from "@/lib/figures";
import type { Figure, Mask } from "@/lib/types";

function FigureImage({ image, children, className = "" }: { image: string; children?: React.ReactNode; className?: string }) {
  const { url, error } = useFigureImage(image);
  if (error) return <p className="text-sm text-rose-700">Bild konnte nicht geladen werden: {error}</p>;
  if (!url) return <div className="aspect-video w-full animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />;
  return (
    <div className={`relative inline-block max-w-full select-none ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs and data URLs */}
      <img src={url} alt="" draggable={false} className="block max-h-[70vh] w-auto max-w-full rounded-lg" />
      {children}
    </div>
  );
}

function box(m: Pick<Mask, "x" | "y" | "w" | "h">) {
  return { left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` };
}

/** Shows a figure while practising: the asked mask in orange, the others covered or open depending on the figure. */
export function FigureQuestion({ figure, maskId, revealed }: { figure: Figure; maskId: string; revealed: boolean }) {
  const target = figure.masks.find((m) => m.id === maskId);
  return (
    <FigureImage image={figure.image}>
      {figure.masks.map((m) =>
        m.id === maskId ? null : figure.hide_all ? (
          <div key={m.id} className="absolute rounded-sm border border-stone-400 bg-stone-200" style={box(m)} />
        ) : null,
      )}
      {target && (
        <div
          className={`absolute flex items-center justify-center overflow-hidden rounded-sm border-2 text-center text-xs font-semibold leading-tight ${
            revealed ? "border-emerald-600 bg-emerald-100/95 text-emerald-900" : "border-orange-600 bg-orange-400 text-white"
          }`}
          style={box(target)}
        >
          {revealed ? target.label : "?"}
        </div>
      )}
    </FigureImage>
  );
}

type Drag =
  | { kind: "draw"; mask: Mask; startX: number; startY: number }
  | { kind: "move"; id: string; dx: number; dy: number }
  | { kind: "resize"; id: string };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Draw, move and resize masks on a figure. Masks are kept as fractions of the image size. */
export function FigureEditor({
  image,
  masks,
  onChange,
  selected,
  onSelect,
  drawLevel,
}: {
  image: string;
  masks: Mask[];
  onChange: (masks: Mask[]) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  drawLevel: number;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  function point(e: ReactPointerEvent) {
    const r = area.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  }

  function down(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const p = point(e);
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-mask]");
    area.current!.setPointerCapture(e.pointerId);
    if (target?.dataset.handle) {
      setDrag({ kind: "resize", id: target.dataset.mask! });
    } else if (target) {
      const m = masks.find((x) => x.id === target.dataset.mask)!;
      onSelect(m.id);
      setDrag({ kind: "move", id: m.id, dx: p.x - m.x, dy: p.y - m.y });
    } else {
      onSelect(null);
      setDrag({ kind: "draw", mask: emptyMask(p.x, p.y, drawLevel), startX: p.x, startY: p.y });
    }
  }

  function move(e: ReactPointerEvent) {
    if (!drag) return;
    const p = point(e);
    if (drag.kind === "draw") {
      const mask = {
        ...drag.mask,
        x: Math.min(p.x, drag.startX),
        y: Math.min(p.y, drag.startY),
        w: Math.abs(p.x - drag.startX),
        h: Math.abs(p.y - drag.startY),
      };
      setDrag({ ...drag, mask });
    } else if (drag.kind === "move") {
      onChange(
        masks.map((m) =>
          m.id === drag.id ? { ...m, x: Math.min(clamp(p.x - drag.dx), 1 - m.w), y: Math.min(clamp(p.y - drag.dy), 1 - m.h) } : m,
        ),
      );
    } else {
      onChange(masks.map((m) => (m.id === drag.id ? { ...m, w: Math.max(0.01, p.x - m.x), h: Math.max(0.01, p.y - m.y) } : m)));
    }
  }

  function up() {
    if (drag?.kind === "draw" && drag.mask.w > 0.01 && drag.mask.h > 0.01) {
      onChange([...masks, drag.mask]);
      onSelect(drag.mask.id);
    }
    setDrag(null);
  }

  const drawing = drag?.kind === "draw" ? drag.mask : null;

  return (
    <FigureImage image={image} className="cursor-crosshair">
      <div ref={area} className="absolute inset-0 touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {masks.map((m) => {
          const level = LEVELS.find((l) => l.value === m.level) ?? LEVELS[0];
          return (
            <div
              key={m.id}
              data-mask={m.id}
              className={`absolute cursor-move overflow-hidden rounded-sm border-2 ${level.tone} ${
                selected === m.id ? "ring-2 ring-sky-500 ring-offset-1" : ""
              }`}
              style={box(m)}
            >
              <span className="pointer-events-none block truncate bg-white/80 px-0.5 text-[10px] font-medium leading-tight text-stone-900">
                {m.level} · {m.label || "…"}
              </span>
              {selected === m.id && (
                <span
                  data-mask={m.id}
                  data-handle="1"
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-sky-500"
                  aria-label="Größe ändern"
                />
              )}
            </div>
          );
        })}
        {drawing && <div className="absolute border-2 border-dashed border-sky-500 bg-sky-500/10" style={box(drawing)} />}
      </div>
    </FigureImage>
  );
}
