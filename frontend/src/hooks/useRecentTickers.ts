"use client";
import { useState, useCallback } from "react";

const STORAGE_KEY = "finsight_recent_tickers";
const MAX_RECENT  = 5;

export function useRecentTickers() {
  const readStored = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  };

  const [recent, setRecent] = useState<string[]>(readStored);

  const addTicker = useCallback((ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecent([]);
  }, []);

  return { recent, addTicker, clearRecent };
}
