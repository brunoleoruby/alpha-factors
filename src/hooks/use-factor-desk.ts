"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveState, replayConfig, stepLive } from "@/lib/trading/engine";
import { DEFAULT_STRATEGY } from "@/lib/trading/universe";
import type { LiveState, StrategyConfig } from "@/lib/trading/types";

export function useFactorDesk() {
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [state, setState] = useState<LiveState>(() => createLiveState(DEFAULT_STRATEGY));
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((prev) => stepLive(prev, configRef.current));
      setTicks((n) => n + 1);
    }, 700);
    return () => window.clearInterval(id);
  }, [running]);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const rebuild = useCallback((next: StrategyConfig = configRef.current) => {
    setRunning(false);
    setTicks(0);
    setBusy(true);
    setError(null);
    try {
      setState(createLiveState(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const applyAndReplay = useCallback((next: StrategyConfig) => {
    setConfig(next);
    setState((prev) => replayConfig(next, prev.market));
  }, []);

  const startAutomation = useCallback(() => {
    setRunning(true);
  }, []);

  return {
    config,
    setConfig,
    state,
    running,
    busy,
    error,
    ticks,
    rebuild,
    applyAndReplay,
    startAutomation,
    stop,
  };
}
