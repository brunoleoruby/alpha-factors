"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeHeadline,
  createNewsState,
  replayConfig,
  stepNews,
  type NewsState,
} from "@/lib/news/engine";
import { DEFAULT_STRATEGY, type StrategyConfig } from "@/lib/news/taxonomy";
import type { BehaviorForecast } from "@/lib/news/patterns";
import type { NewsItem } from "@/lib/news/corpus";
import type { Listing } from "@/lib/markets/types";
import type { ExchangeId } from "@/lib/markets/types";

export function useNewsDesk(opts: {
  listings: Listing[];
  locale: ExchangeId;
  settingsKey: string;
  defaultPaste: string;
  defaultSymbol: string;
  defaultConfig?: StrategyConfig;
}) {
  const startConfig = opts.defaultConfig ?? DEFAULT_STRATEGY;
  const [config, setConfig] = useState<StrategyConfig>(startConfig);
  const [state, setState] = useState<NewsState>(() =>
    createNewsState(startConfig, { listings: opts.listings, locale: opts.locale }),
  );
  const [running, setRunning] = useState(false);
  const [paste, setPaste] = useState(opts.defaultPaste);
  const [pasteSymbol, setPasteSymbol] = useState(opts.defaultSymbol);
  const [scratch, setScratch] = useState<{ item: NewsItem; forecast: BehaviorForecast } | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
    try {
      localStorage.setItem(opts.settingsKey, JSON.stringify(config));
    } catch {
      /* ignore quota */
    }
  }, [config, opts.settingsKey]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((prev) => stepNews(prev, configRef.current));
    }, 900);
    return () => window.clearInterval(id);
  }, [running]);

  const applyConfig = useCallback((next: StrategyConfig) => {
    setConfig(next);
    setState((prev) => replayConfig(prev, next));
  }, []);

  const rebuild = useCallback(() => {
    setRunning(false);
    setState(
      createNewsState(configRef.current, {
        listings: opts.listings,
        locale: opts.locale,
        seed: Math.floor(Math.random() * 10_000),
      }),
    );
    setScratch(null);
  }, [opts.listings, opts.locale]);

  const select = useCallback((id: string) => {
    setState((prev) => ({ ...prev, selectedId: id }));
    setScratch(null);
  }, []);

  const runPaste = useCallback(() => {
    const headline = paste.trim();
    if (!headline) return;
    setScratch(analyzeHeadline(headline, pasteSymbol, state, config));
  }, [config, paste, pasteSymbol, state]);

  return {
    config,
    setConfig,
    applyConfig,
    state,
    running,
    setRunning,
    paste,
    setPaste,
    pasteSymbol,
    setPasteSymbol,
    names: opts.listings,
    scratch,
    rebuild,
    select,
    runPaste,
  };
}
