"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeHeadline,
  createNewsState,
  replayConfig,
  stepNews,
  type NewsState,
} from "@/lib/news/engine";
import { DEFAULT_STRATEGY, NAMES, type StrategyConfig } from "@/lib/news/taxonomy";
import type { BehaviorForecast } from "@/lib/news/patterns";
import type { NewsItem } from "@/lib/news/corpus";

const SETTINGS_KEY = "news-pattern-desk-settings";

export function useNewsDesk() {
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [state, setState] = useState<NewsState>(() => createNewsState(DEFAULT_STRATEGY));
  const [running, setRunning] = useState(false);
  const [paste, setPaste] = useState("Apple cuts guidance on softer iPhone trends in China");
  const [pasteSymbol, setPasteSymbol] = useState("AAPL");
  const [scratch, setScratch] = useState<{ item: NewsItem; forecast: BehaviorForecast } | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    } catch {
      /* ignore quota */
    }
  }, [config]);

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
    setState(createNewsState(configRef.current, Math.floor(Math.random() * 10_000)));
    setScratch(null);
  }, []);

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
    names: NAMES,
    scratch,
    rebuild,
    select,
    runPaste,
  };
}
