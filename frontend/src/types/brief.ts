export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
}

export interface GuidanceSignal {
  text: string;
  tag: "optimistic" | "cautious" | "neutral";
  offset: number;
}

export interface RiskDelta {
  added: string[];
  removed: string[];
  modified: [string, string][];
}

export interface RagChunk {
  text: string;
  score: number;
}

export interface Brief {
  ticker: string;
  quarter: string;
  generated_at: string;
  sentiment: {
    score: SentimentScore;
    label: "positive" | "negative" | "neutral";
    trend: "up" | "down" | "flat" | null;
  };
  guidance: GuidanceSignal[];
  risk_delta: RiskDelta;
  rag_results: Record<string, RagChunk[]>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { text: string; quarter?: string }[];
}

export interface ChatResponse {
  answer: string;
  sources: { text: string; quarter?: string }[];
}

export interface MarketSnapshot {
  ticker: string;
  price: number | null;
  pe_ratio: number | null;
  market_cap: number | null;
  "52w_high": number | null;
  "52w_low": number | null;
}
