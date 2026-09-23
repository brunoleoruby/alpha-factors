import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export type ChartPoint = { time: Time; price: number };

export type DefenceDraw =
  | { id: string; kind: "line"; a: ChartPoint; b: ChartPoint }
  | { id: string; kind: "range"; a: ChartPoint; b: ChartPoint }
  | { id: string; kind: "rr"; entry: ChartPoint; stop: ChartPoint; target: ChartPoint };

export type DrawHandle = "a" | "b" | "entry" | "stop" | "target" | "body";
export type Hit = { id: string; handle: DrawHandle };

type Coord = { x: number; y: number; price: number };

function nid() {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function clone(d: DefenceDraw): DefenceDraw {
  return structuredClone(d);
}

function xy(chart: IChartApi, series: ISeriesApi<"Candlestick">, p: ChartPoint): Coord | null {
  const x = chart.timeScale().timeToCoordinate(p.time);
  const y = series.priceToCoordinate(p.price);
  if (x == null || y == null) return null;
  return { x, y, price: p.price };
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  if (len < 1) return dist(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return dist(px, py, ax + dx * t, ay + dy * t);
}

function handleHit(px: number, py: number, x: number, y: number) {
  return Math.abs(px - x) <= 7 && Math.abs(py - y) <= 7;
}

function box(a: Coord, b: Coord) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x) || 8, h: Math.abs(b.y - a.y) || 8 };
}

class DrawRenderer implements IPrimitivePaneRenderer {
  constructor(private source: DefenceDrawPrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const chart = this.source.chart;
    const series = this.source.series;
    if (!chart || !series) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.font = "12px ui-monospace, monospace";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const d of this.source.drawings) this.paint(ctx, chart, series, mediaSize.width, d);
      if (this.source.draft.length) this.paintDraft(ctx, chart, series, mediaSize.width);
      ctx.restore();
    });
  }

  private paint(
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    width: number,
    d: DefenceDraw,
  ) {
    const selected = this.source.selectedId === d.id;
    if (d.kind === "line") {
      const a = xy(chart, series, d.a);
      const b = xy(chart, series, d.b);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.strokeStyle = selected ? "#0d47a1" : "#1565c0";
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (selected) this.handles(ctx, [a, b]);
      return;
    }
    if (d.kind === "range") {
      const a = xy(chart, series, d.a);
      const b = xy(chart, series, d.b);
      if (!a || !b) return;
      const r = box(a, b);
      ctx.fillStyle = selected ? "rgba(21, 101, 192, 0.2)" : "rgba(21, 101, 192, 0.12)";
      ctx.strokeStyle = selected ? "#0d47a1" : "#1565c0";
      ctx.lineWidth = selected ? 2.2 : 1.5;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      const hi = Math.max(a.price, b.price);
      const lo = Math.min(a.price, b.price);
      const span = hi - lo;
      const pct = lo > 0 ? (span / lo) * 100 : 0;
      ctx.fillStyle = "#1565c0";
      ctx.fillText(`Range ${span.toFixed(2)}  ·  ${pct.toFixed(2)}%`, r.x + 6, r.y + 14);
      if (selected) this.handles(ctx, [a, b]);
      return;
    }
    const entry = xy(chart, series, d.entry);
    const stop = xy(chart, series, d.stop);
    const target = xy(chart, series, d.target);
    if (!entry || !stop || !target) return;
    const left = Math.min(entry.x, stop.x, target.x);
    const right = Math.max(entry.x, stop.x, target.x, left + 80);
    ctx.fillStyle = "rgba(255, 23, 68, 0.16)";
    ctx.fillRect(left, Math.min(entry.y, stop.y), right - left, Math.abs(stop.y - entry.y) || 2);
    ctx.fillStyle = "rgba(0, 230, 118, 0.16)";
    ctx.fillRect(left, Math.min(entry.y, target.y), right - left, Math.abs(target.y - entry.y) || 2);
    ctx.strokeStyle = selected ? "#000" : "#111";
    ctx.lineWidth = selected ? 2 : 1.5;
    for (const y of [entry.y, stop.y, target.y]) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(Math.min(right, width), y);
      ctx.stroke();
    }
    const risk = Math.abs(d.entry.price - d.stop.price);
    const reward = Math.abs(d.target.price - d.entry.price);
    const rr = risk > 0 ? reward / risk : 0;
    ctx.fillStyle = "#111";
    ctx.fillText(
      `Entry ${d.entry.price.toFixed(2)}  Stop ${d.stop.price.toFixed(2)}  Target ${d.target.price.toFixed(2)}  R:R 1 : ${rr.toFixed(2)}`,
      left + 6,
      Math.min(entry.y, stop.y, target.y) - 8,
    );
    if (selected) this.handles(ctx, [entry, stop, target]);
  }

  private paintDraft(
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    width: number,
  ) {
    const pts = this.source.draft.map((p) => xy(chart, series, p)).filter(Boolean) as Coord[];
    ctx.fillStyle = "#111";
    for (const c of pts) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pts.length === 2 && this.source.draftKind !== "rr") {
      if (this.source.draftKind === "range") {
        const r = box(pts[0], pts[1]);
        ctx.fillStyle = "rgba(21, 101, 192, 0.1)";
        ctx.strokeStyle = "#1565c0";
        ctx.setLineDash([5, 4]);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "#1565c0";
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (this.source.draftKind === "rr" && pts.length >= 2) {
      const [entry, stop, target] = pts;
      const left = Math.min(...pts.map((p) => p.x));
      const right = Math.max(...pts.map((p) => p.x), left + 80, width * 0.2);
      ctx.fillStyle = "rgba(255, 23, 68, 0.12)";
      ctx.fillRect(left, Math.min(entry.y, stop.y), right - left, Math.abs(stop.y - entry.y) || 2);
      if (target) {
        ctx.fillStyle = "rgba(0, 230, 118, 0.12)";
        ctx.fillRect(left, Math.min(entry.y, target.y), right - left, Math.abs(target.y - entry.y) || 2);
      }
    }
  }

  private handles(ctx: CanvasRenderingContext2D, pts: Coord[]) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#0d47a1";
    ctx.lineWidth = 1.5;
    for (const p of pts) {
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
    }
  }
}

class DrawPaneView implements IPrimitivePaneView {
  private rendererObj: DrawRenderer;

  constructor(source: DefenceDrawPrimitive) {
    this.rendererObj = new DrawRenderer(source);
  }

  zOrder() {
    return "top" as const;
  }

  update() {}

  renderer() {
    return this.rendererObj;
  }
}

export class DefenceDrawPrimitive implements ISeriesPrimitive<Time> {
  drawings: DefenceDraw[] = [];
  draft: ChartPoint[] = [];
  draftKind: "line" | "range" | "rr" | null = null;
  selectedId: string | null = null;
  chart: IChartApi | null = null;
  series: ISeriesApi<"Candlestick"> | null = null;
  private history: DefenceDraw[][] = [];
  private requestUpdate: (() => void) | null = null;
  private readonly view: DrawPaneView;
  private readonly onChange: () => void;

  constructor(onChange: () => void = () => undefined) {
    this.view = new DrawPaneView(this);
    this.onChange = onChange;
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = param.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  get canDelete() {
    return this.selectedId != null || this.drawings.length > 0;
  }

  refresh() {
    this.requestUpdate?.();
    this.onChange();
  }

  setDraft(points: ChartPoint[], kind: "line" | "range" | "rr" | null = this.draftKind) {
    this.draft = points;
    this.draftKind = kind;
    this.requestUpdate?.();
  }

  add(draw: Omit<DefenceDraw, "id"> & { id?: string }) {
    this.pushHistory();
    const next = { ...draw, id: draw.id ?? nid() } as DefenceDraw;
    this.drawings = [...this.drawings, next];
    this.draft = [];
    this.draftKind = null;
    this.selectedId = next.id;
    this.refresh();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.drawings = prev;
    this.draft = [];
    this.selectedId = this.drawings.at(-1)?.id ?? null;
    this.refresh();
  }

  deleteSelected() {
    if (this.selectedId) {
      this.pushHistory();
      this.drawings = this.drawings.filter((d) => d.id !== this.selectedId);
      this.selectedId = this.drawings.at(-1)?.id ?? null;
      this.refresh();
      return;
    }
    if (!this.drawings.length) return;
    this.pushHistory();
    this.drawings = this.drawings.slice(0, -1);
    this.selectedId = this.drawings.at(-1)?.id ?? null;
    this.refresh();
  }

  clear() {
    if (!this.drawings.length && !this.draft.length) return;
    this.pushHistory();
    this.drawings = [];
    this.draft = [];
    this.selectedId = null;
    this.refresh();
  }

  select(id: string | null) {
    this.selectedId = id;
    this.refresh();
  }

  hit(px: number, py: number): Hit | null {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return null;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (!d) continue;
      if (d.kind === "line" || d.kind === "range") {
        const a = xy(chart, series, d.a);
        const b = xy(chart, series, d.b);
        if (!a || !b) continue;
        if (handleHit(px, py, a.x, a.y)) return { id: d.id, handle: "a" };
        if (handleHit(px, py, b.x, b.y)) return { id: d.id, handle: "b" };
        if (d.kind === "line" && distSeg(px, py, a.x, a.y, b.x, b.y) <= 8) {
          return { id: d.id, handle: "body" };
        }
        if (d.kind === "range") {
          const r = box(a, b);
          if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
            return { id: d.id, handle: "body" };
          }
        }
        continue;
      }
      const entry = xy(chart, series, d.entry);
      const stop = xy(chart, series, d.stop);
      const target = xy(chart, series, d.target);
      if (!entry || !stop || !target) continue;
      if (handleHit(px, py, entry.x, entry.y)) return { id: d.id, handle: "entry" };
      if (handleHit(px, py, stop.x, stop.y)) return { id: d.id, handle: "stop" };
      if (handleHit(px, py, target.x, target.y)) return { id: d.id, handle: "target" };
      const left = Math.min(entry.x, stop.x, target.x);
      const right = Math.max(entry.x, stop.x, target.x, left + 80);
      const top = Math.min(entry.y, stop.y, target.y);
      const bot = Math.max(entry.y, stop.y, target.y);
      if (px >= left && px <= right && py >= top && py <= bot) return { id: d.id, handle: "body" };
    }
    return null;
  }

  beginEdit() {
    this.pushHistory();
  }

  applyPoint(id: string, handle: DrawHandle, point: ChartPoint, origin?: DefenceDraw) {
    const src = origin ?? this.drawings.find((d) => d.id === id);
    if (!src) return;
    let next: DefenceDraw = clone(src);
    if (handle === "body" && origin) {
      const dxPrice = point.price - this.anchorPrice(origin);
      if (next.kind === "rr") {
        const shift = (p: ChartPoint): ChartPoint => ({
          time: this.shiftTime(p.time, origin.entry.time, point.time),
          price: p.price + dxPrice,
        });
        next = {
          ...next,
          entry: shift(origin.entry),
          stop: shift(origin.stop),
          target: shift(origin.target),
        };
      } else {
        next = {
          ...next,
          a: {
            time: this.shiftTime(origin.a.time, origin.a.time, point.time),
            price: origin.a.price + dxPrice,
          },
          b: {
            time: this.shiftTime(origin.b.time, origin.a.time, point.time),
            price: origin.b.price + dxPrice,
          },
        };
      }
    } else if (next.kind === "line" || next.kind === "range") {
      if (handle === "a") next = { ...next, a: point };
      if (handle === "b") next = { ...next, b: point };
    } else if (next.kind === "rr") {
      if (handle === "entry") next = { ...next, entry: point };
      if (handle === "stop") next = { ...next, stop: point };
      if (handle === "target") next = { ...next, target: point };
    }
    this.drawings = this.drawings.map((d) => (d.id === id ? next : d));
    this.selectedId = id;
    this.requestUpdate?.();
  }

  toPoint(x: number, y: number): ChartPoint | null {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return null;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time, price };
  }

  updateAllViews() {
    this.view.update();
  }

  paneViews() {
    return [this.view];
  }

  private pushHistory() {
    this.history.push(this.drawings.map(clone));
    if (this.history.length > 40) this.history.shift();
  }

  private anchorPrice(d: DefenceDraw) {
    return d.kind === "rr" ? d.entry.price : d.a.price;
  }

  private shiftTime(orig: Time, from: Time, to: Time): Time {
    const chart = this.chart;
    if (!chart) return orig;
    const ox = chart.timeScale().timeToCoordinate(orig);
    const fx = chart.timeScale().timeToCoordinate(from);
    const tx = chart.timeScale().timeToCoordinate(to);
    if (ox == null || fx == null || tx == null) return orig;
    return chart.timeScale().coordinateToTime(ox + (tx - fx)) ?? orig;
  }
}
