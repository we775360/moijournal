import { useEffect, useRef, useState } from "react";
import type { Stroke } from "@/lib/journal";

const PEN_COLORS = ["#3b2f2a", "#e0607e", "#5b8def", "#4fa36b", "#e8a33d", "#9b6bd6"];

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * scale;
    ctx.beginPath();
    for (let i = 0; i < s.p.length; i += 2) {
      const x = (s.p[i] ?? 0) * scale;
      const y = (s.p[i + 1] ?? 0) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (s.p.length === 2) ctx.lineTo((s.p[0] ?? 0) * scale + 0.1, (s.p[1] ?? 0) * scale);
    ctx.stroke();
  }
}

// Logical canvas is 1000 units wide; strokes store integer coords => tiny, resolution-independent data.
export function DrawPad({
  value,
  onChange,
  ratio = 0.4,
  label,
  defaultWidth = 4,
  palette = true,
}: {
  value: Stroke[];
  onChange: (s: Stroke[]) => void;
  ratio?: number;
  label: string;
  defaultWidth?: number;
  palette?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cur = useRef<Stroke | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0] ?? "#000");
  const [width, setWidth] = useState(defaultWidth);
  const H = Math.round(1000 * ratio);

  const redraw = () => {
    const c = ref.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const all = cur.current ? [...value, cur.current] : value;
    drawStrokes(ctx, all, c.width / 1000);
  };

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(redraw);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  });

  const pt = (e: React.PointerEvent) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000))),
      Math.max(0, Math.min(H, Math.round(((e.clientY - r.top) / r.height) * H))),
    ] as const;
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-hand text-xl text-ink">{label}</span>
        {palette && (
          <div className="flex gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pen colour ${c}`}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-ink scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
        {palette && (
          <div className="flex gap-1">
            {[2, 4, 8].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={`grid h-7 w-7 place-items-center rounded-full border-2 ${width === w ? "border-ink bg-muted" : "border-transparent"}`}
                aria-label={`Pen size ${w}`}
              >
                <span className="rounded-full bg-ink" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => onChange(value.slice(0, -1))}
            className="rounded-full px-3 py-1 text-sm font-bold text-ink hover:bg-muted"
          >
            ↶ undo
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-full px-3 py-1 text-sm font-bold text-ink hover:bg-muted"
          >
            clear
          </button>
        </div>
      </div>
      <canvas
        ref={ref}
        className="w-full touch-none rounded-xl border-2 border-dashed border-ink/40 bg-paper"
        style={{ aspectRatio: `1000 / ${H}`, cursor: "crosshair" }}
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          cur.current = { c: color, w: width, p: [...pt(e)] };
          redraw();
        }}
        onPointerMove={(e) => {
          if (!cur.current) return;
          const [x, y] = pt(e);
          const p = cur.current.p;
          const lx = p[p.length - 2] ?? 0;
          const ly = p[p.length - 1] ?? 0;
          if (Math.abs(x - lx) + Math.abs(y - ly) < 3) return;
          p.push(x, y);
          redraw();
        }}
        onPointerUp={() => {
          if (cur.current) onChange([...value, cur.current]);
          cur.current = null;
        }}
        onPointerCancel={() => {
          cur.current = null;
          redraw();
        }}
      />
    </div>
  );
}
