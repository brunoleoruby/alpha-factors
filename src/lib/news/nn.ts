import { EVENT_TYPES } from "./taxonomy";
import type { NewsItem } from "./corpus";
import { mulberry32 } from "@/lib/rng";

const HID = 12;
const OUT = 2;

export type NeuralNet = {
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
};

export type NeuralFit = {
  net: NeuralNet;
  loss: number;
  samples: number;
};

const ALT_SOURCES = /moneycontrol|economic times|business standard|mint|nse|you/i;
const WIRE_SOURCES = /reuters|bloomberg|wsj|cnbc|ft/i;
const ALT_KW = /sebi|rbi|gst|fii|repo rate|qip|usfda|cpi|inflation/;

export function altFeatureVector(item: NewsItem, cascade: number, echo: number): number[] {
  const cls = item.classification;
  const headline = item.headline.toLowerCase();
  const event = EVENT_TYPES.map((id) => (cls.eventType === id ? 1 : 0));
  return [
    cls.sentiment,
    cls.intensity,
    Math.min(1, cls.eventScore / 4),
    ALT_SOURCES.test(item.source) ? 1 : 0,
    WIRE_SOURCES.test(item.source) ? 1 : 0,
    /\d/.test(item.headline) ? 1 : 0,
    ALT_KW.test(headline) ? 1 : 0,
    Math.min(1, item.headline.split(/\s+/).length / 22),
    cascade,
    echo,
    ...event,
  ];
}

function tanh(x: number) {
  if (x > 8) return 1;
  if (x < -8) return -1;
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

function matVec(m: number[][], v: number[], b: number[]) {
  return m.map((row, i) => row.reduce((s, w, j) => s + w * v[j], b[i]));
}

export function forward(net: NeuralNet, x: number[]): [number, number] {
  const h = matVec(net.w1, x, net.b1).map(tanh);
  const y = matVec(net.w2, h, net.b2);
  return [y[0], y[1]];
}

function randn(rand: () => number) {
  const u = Math.max(1e-9, rand());
  const v = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function zeros(r: number, c?: number) {
  if (c === undefined) return Array.from({ length: r }, () => 0);
  return Array.from({ length: r }, () => Array.from({ length: c }, () => 0));
}

export function trainNewsNet(items: NewsItem[], seed = 3): NeuralFit {
  const samples = items.filter((it) => Number.isFinite(it.ret1d) && Number.isFinite(it.ret5d));
  const inSize = samples[0]
    ? altFeatureVector(samples[0], 0, 0).length
    : EVENT_TYPES.length + 10;
  const rand = mulberry32(seed + 91);
  const scale = Math.sqrt(2 / inSize);
  const net: NeuralNet = {
    w1: Array.from({ length: HID }, () => Array.from({ length: inSize }, () => randn(rand) * scale)),
    b1: zeros(HID) as number[],
    w2: Array.from({ length: OUT }, () => Array.from({ length: HID }, () => randn(rand) * Math.sqrt(2 / HID))),
    b2: zeros(OUT) as number[],
  };

  if (samples.length < 20) {
    return { net, loss: 0, samples: samples.length };
  }

  const bySymbol = new Map<string, NewsItem[]>();
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  const cascadeAt = new Map<string, number>();
  for (const it of sorted) {
    const prev = bySymbol.get(it.symbol) ?? [];
    const cut = Date.parse(it.date) - 2 * 86_400_000;
    const cascade = prev.some(
      (p) => p.classification.eventType === it.classification.eventType && Date.parse(p.date) >= cut,
    )
      ? 1
      : 0;
    cascadeAt.set(it.id, cascade);
    prev.push(it);
    bySymbol.set(it.symbol, prev);
  }

  const xs = sorted.map((it) => altFeatureVector(it, cascadeAt.get(it.id) ?? 0, 0));
  const ys = sorted.map((it) => [it.ret1d, it.ret5d] as [number, number]);
  const lr = 0.025;
  const epochs = 28;
  let loss = 0;

  for (let ep = 0; ep < epochs; ep++) {
    loss = 0;
    for (let n = 0; n < xs.length; n++) {
      const x = xs[n];
      const target = ys[n];
      const z1 = matVec(net.w1, x, net.b1);
      const h = z1.map(tanh);
      const y = matVec(net.w2, h, net.b2);
      const e0 = y[0] - target[0];
      const e1 = y[1] - target[1];
      loss += 0.5 * (e0 * e0 + e1 * e1);

      const dy = [e0, e1];
      const dh = zeros(HID) as number[];
      for (let o = 0; o < OUT; o++) {
        for (let j = 0; j < HID; j++) {
          dh[j] += net.w2[o][j] * dy[o];
        }
      }
      for (let o = 0; o < OUT; o++) {
        net.b2[o] -= lr * dy[o];
        for (let j = 0; j < HID; j++) {
          net.w2[o][j] -= lr * dy[o] * h[j];
        }
      }
      for (let j = 0; j < HID; j++) {
        const dt = dh[j] * (1 - h[j] * h[j]);
        net.b1[j] -= lr * dt;
        for (let i = 0; i < inSize; i++) {
          net.w1[j][i] -= lr * dt * x[i];
        }
      }
    }
    loss /= xs.length;
  }

  return { net, loss, samples: xs.length };
}

export function neuralMove(net: NeuralNet, item: NewsItem, cascade: boolean, echo: boolean) {
  const y = forward(net, altFeatureVector(item, cascade ? 1 : 0, echo ? 1 : 0));
  return { neural1d: y[0], neural5d: y[1] };
}
