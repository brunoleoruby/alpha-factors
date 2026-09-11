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
import type { SwingPoint } from "@/lib/markets/swings";

export type ZigzagPoint = { time: Time; price: number; kind: "high" | "low" };

const DOWN = "#a33a4a";
const UP = "#3d9a78";

class ZigzagRenderer implements IPrimitivePaneRenderer {
  constructor(private points: { x: number; y: number; kind: "high" | "low" }[]) {}

  draw(target: CanvasRenderingTarget2D) {
    if (this.points.length < 2) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = a.kind === "high" ? DOWN : UP;
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

class ZigzagPaneView implements IPrimitivePaneView {
  private rendererObj: ZigzagRenderer | null = null;

  constructor(private source: SwingZigzagPrimitive) {}

  zOrder() {
    return "top" as const;
  }

  update() {
    const chart = this.source.chart;
    const series = this.source.series;
    if (!chart || !series) {
      this.rendererObj = null;
      return;
    }
    const timeScale = chart.timeScale();
    const coords: { x: number; y: number; kind: "high" | "low" }[] = [];
    for (const p of this.source.points) {
      const x = timeScale.timeToCoordinate(p.time);
      const y = series.priceToCoordinate(p.price);
      if (x == null || y == null) continue;
      coords.push({ x, y, kind: p.kind });
    }
    this.rendererObj = new ZigzagRenderer(coords);
  }

  renderer() {
    return this.rendererObj;
  }
}

export class SwingZigzagPrimitive implements ISeriesPrimitive<Time> {
  points: ZigzagPoint[] = [];
  chart: IChartApi | null = null;
  series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly view = new ZigzagPaneView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = param.requestUpdate;
    this.view.update();
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  setPoints(points: SwingPoint[], toTime: (unix: number) => Time) {
    this.points = points.map((p) => ({ time: toTime(p.time), price: p.price, kind: p.kind }));
    this.requestUpdate?.();
  }

  updateAllViews() {
    this.view.update();
  }

  paneViews() {
    return [this.view];
  }
}
