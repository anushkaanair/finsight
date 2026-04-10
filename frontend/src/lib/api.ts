import type { ChatResponse, MarketSnapshot } from "@/types/brief";

const BASE_URL = "http://localhost:5000";

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

export async function fetchMarketData(ticker: string): Promise<MarketSnapshot> {
  const res = await fetch(`${BASE_URL}/api/market/${ticker}`);
  if (!res.ok) throw new Error(`Market API error: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
