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
  const timer = useRef<number | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const stop = useCallback(() => {
    setRunning(false);
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const rebuild = useCallback((next: StrategyConfig = configRef.current) => {
    stop();
    setBusy(true);
    setError(null);
    try {
      setState(createLiveState(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed.");
    } finally {
      setBusy(false);
    }
  }, [stop]);

  const applyAndReplay = useCallback((next: StrategyConfig) => {
    setConfig(next);
    setState((prev) => replayConfig(next, prev.market));
  }, []);

  const startAutomation = useCallback(() => {
    if (timer.current) return;
    setRunning(true);
    timer.current = window.setInterval(() => {
      setState((prev) => stepLive(prev, configRef.current));
    }, 900);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    config,
    setConfig,
    state,
    running,
    busy,
    error,
    rebuild,
    applyAndReplay,
    startAutomation,
    stop,
  };
}
