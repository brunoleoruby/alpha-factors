import type { Classification } from "./classify";
import { EVENT_TYPES } from "./taxonomy";

export type Vocab = Map<string, number>;

export function buildVocab(docs: string[][]) {
  const df = new Map<string, number>();
  for (const doc of docs) {
    const unique = new Set(doc);
    for (const t of unique) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const vocab: Vocab = new Map();
  let i = 0;
  for (const [term, count] of df) {
    if (count < 2) continue;
    vocab.set(term, i++);
  }
  for (const id of EVENT_TYPES) {
    vocab.set(`evt:${id}`, i++);
  }
  return { vocab, df, nDocs: docs.length };
}

export type VectorSpace = {
  vocab: Vocab;
  idf: Float64Array;
};

export function makeSpace(docs: string[][]): VectorSpace {
  const { vocab, df, nDocs } = buildVocab(docs);
  const idf = new Float64Array(vocab.size);
  for (const [term, idx] of vocab) {
    const d = df.get(term) ?? nDocs;
    idf[idx] = Math.log((nDocs + 1) / (d + 1)) + 1;
  }
  return { vocab, idf };
}

export function vectorize(space: VectorSpace, cls: Classification, extra: string[] = []) {
  const tf = new Map<number, number>();
  const bump = (term: string, w = 1) => {
    const idx = space.vocab.get(term);
    if (idx === undefined) return;
    tf.set(idx, (tf.get(idx) ?? 0) + w);
  };
  for (const t of cls.terms) bump(t, 1);
  for (const t of extra) bump(t, 1);
  bump(`evt:${cls.eventType}`, 3.5);

  const vec = new Float64Array(space.vocab.size);
  for (const [idx, f] of tf) {
    vec[idx] = f * space.idf[idx];
  }
  let n = 0;
  for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
  n = Math.sqrt(n);
  if (n > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= n;
  }
  return vec;
}

export function cosine(a: Float64Array, b: Float64Array) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
