import type {
  ChatResponse,
  MarketSnapshot,
  AnalysisResult,
  CompareResult,
  HistoryItem,
  WatchlistItem,
  TrendPoint,
} from "@/types/brief";

const BASE_URL = "http://localhost:5000";

// ── analyze ────────────────────────────────────────────────────────────────
export async function runAnalysis(
  ticker: string,
  quarter: string
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, quarter }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server ${res.status}`);
  }
  return res.json();
}

// ── compare ────────────────────────────────────────────────────────────────
export async function compareTickersAPI(
  tickers: string[],
  quarter: string
): Promise<CompareResult> {
  const res = await fetch(`${BASE_URL}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, quarter }),
  });
  if (!res.ok) throw new Error(`Compare API error: ${res.status}`);
  return res.json();
}

// ── chat ───────────────────────────────────────────────────────────────────
export async function sendChatMessage(
  query: string,
  ticker: string,
  context: string = ""
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ticker, context }),
  });
  if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
  return res.json();
}

// ── market ─────────────────────────────────────────────────────────────────
export async function fetchMarketData(ticker: string): Promise<MarketSnapshot> {
  const res = await fetch(`${BASE_URL}/api/market/${ticker}`);
  if (!res.ok) throw new Error(`Market API error: ${res.status}`);
  return res.json();
}

// ── history ────────────────────────────────────────────────────────────────
export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE_URL}/api/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.history || [];
}

// ── trend ──────────────────────────────────────────────────────────────────
export async function fetchTrend(ticker: string): Promise<TrendPoint[]> {
  const res = await fetch(`${BASE_URL}/api/trend/${ticker}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.trend || [];
}

// ── watchlist ──────────────────────────────────────────────────────────────
export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const res = await fetch(`${BASE_URL}/api/watchlist`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.watchlist || [];
}

export async function addToWatchlist(ticker: string): Promise<void> {
  await fetch(`${BASE_URL}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  await fetch(`${BASE_URL}/api/watchlist/${ticker}`, { method: "DELETE" });
}

// ── health ─────────────────────────────────────────────────────────────────
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
