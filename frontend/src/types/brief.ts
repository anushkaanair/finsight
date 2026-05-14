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

export interface Financials {
  available: boolean;
  revenue?: string;
  net_income?: string;
  gross_profit?: string;
  operating_income?: string;
  rd_expense?: string;
  total_assets?: string;
  eps_basic?: string;
  eps_diluted?: string;
  gross_margin?: string;
  operating_margin?: string;
  net_margin?: string;
}

export interface MarketSnapshot {
  ticker: string;
  price: number | null;
  pe_ratio: number | null;
  market_cap: number | null;
  "52w_high": number | null;
  "52w_low": number | null;
}

export interface AnalysisResult {
  ticker: string;
  quarter: string;
  generated_at: string;
  sentiment: {
    score: SentimentScore;
    label: "positive" | "negative" | "neutral";
    trend?: "up" | "down" | "flat" | null;
    paragraph_count?: number;
  };
  guidance: GuidanceSignal[];
  risk_delta: RiskDelta;
  financials: Financials;
  market: MarketSnapshot;
  brief: string;
}

export interface HistoryItem {
  ticker: string;
  quarter: string;
  generated_at: string;
  sentiment_label: string;
  sentiment_pos: number;
  sentiment_neg: number;
  guidance_count: number;
  risk_added: number;
  risk_removed: number;
  brief: string;
}

export interface CompareEntry {
  sentiment: { score: SentimentScore; label: string };
  guidance_count: number;
  optimistic_count: number;
  cautious_count: number;
  risk_added: number;
  risk_removed: number;
  financials: Financials;
  market: MarketSnapshot;
  brief: string;
}

export interface CompareResult {
  quarter: string;
  results: Record<string, CompareEntry>;
  errors: Record<string, string>;
}

export interface WatchlistItem {
  ticker: string;
  added_at: string;
  sentiment_label: string | null;
  last_quarter: string | null;
  last_analyzed: string | null;
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

export interface TrendPoint {
  quarter: string;
  sentiment_label: string;
  sentiment_pos: number;
  sentiment_neg: number;
  sentiment_neu: number;
}
