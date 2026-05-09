"use client";
import { useState, Suspense, lazy } from "react";
import {
  Home, BarChart2, Shield, Zap, MessageCircle,
  Search, TrendingUp, TrendingDown, Minus,
  FileText, Brain, Database, ChevronRight, Activity
} from "lucide-react";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { Chatbot } from "@/components/ui/chatbot";

const SplineScene = lazy(() => import("@/components/ui/splite"));

/* ── Pipeline nodes for RadialOrbitalTimeline ── */
const pipelineNodes = [
  {
    id: 1,
    title: "EDGAR",
    date: "Ingestion",
    content: "Fetches 10-K and 10-Q filings directly from SEC EDGAR. No API key required — fully free and automated.",
    category: "data",
    icon: FileText,
    relatedIds: [2],
    status: "completed" as const,
    energy: 95,
  },
  {
    id: 2,
    title: "Parser",
    date: "Extraction",
    content: "BeautifulSoup lxml parser extracts Risk Factors, MD&A, and Financials sections from raw HTML filings.",
    category: "processing",
    icon: Search,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 88,
  },
  {
    id: 3,
    title: "FinBERT",
    date: "Sentiment",
    content: "ProsusAI/finbert scores each MD&A paragraph. Weighted average produces composite sentiment signal.",
    category: "analysis",
    icon: Brain,
    relatedIds: [2, 4, 5],
    status: "completed" as const,
    energy: 82,
  },
  {
    id: 4,
    title: "Risk Δ",
    date: "Delta",
    content: "difflib detects added, removed, and modified risk factor sentences between quarters.",
    category: "analysis",
    icon: Shield,
    relatedIds: [3, 6],
    status: "completed" as const,
    energy: 76,
  },
  {
    id: 5,
    title: "FAISS",
    date: "Retrieval",
    content: "all-MiniLM-L6-v2 embeddings indexed in FAISS per quarter. Top-k retrieval powers temporal RAG.",
    category: "rag",
    icon: Database,
    relatedIds: [3, 6],
    status: "completed" as const,
    energy: 90,
  },
  {
    id: 6,
    title: "Brief",
    date: "Report",
    content: "Analyst brief assembled from sentiment, risk deltas, and guidance signals. PDF export via ReportLab.",
    category: "output",
    icon: Activity,
    relatedIds: [4, 5],
    status: "in-progress" as const,
    energy: 68,
  },
];

function SentimentTag({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower === "positive") return <span className="tag-optimistic px-2 py-0.5 rounded-full text-xs font-semibold">Optimistic</span>;
  if (lower === "negative") return <span className="tag-cautious px-2 py-0.5 rounded-full text-xs font-semibold">Cautious</span>;
  return <span className="tag-neutral px-2 py-0.5 rounded-full text-xs font-semibold">Neutral</span>;
}

function SentimentIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower === "positive") return <TrendingUp size={16} className="text-emerald-400" />;
  if (lower === "negative") return <TrendingDown size={16} className="text-red-400" />;
  return <Minus size={16} className="text-yellow-400" />;
}

interface AnalysisResult {
  ticker: string;
  quarter: string;
  sentiment: { label: string; score: { positive: number; negative: number; neutral: number } };
  guidance: { text: string; tag: string }[];
  risk_delta: { added: string[]; removed: string[]; modified: [string, string][] };
  brief: string;
}

const dockItems = [
  { icon: Home, label: "Home", id: "home" },
  { icon: BarChart2, label: "Analysis", id: "analysis" },
  { icon: Shield, label: "Risk", id: "risk" },
  { icon: Zap, label: "Pipeline", id: "pipeline" },
  { icon: MessageCircle, label: "Chat", id: "chat" },
];

export default function Page() {
  const [ticker, setTicker] = useState("");
  const [quarter, setQuarter] = useState("Q1-2024");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("home");

  const analyze = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), quarter }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResult(data);
      setActiveSection("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed — is the Flask server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* Background blobs */}
      <div
        className="blob-green"
        style={{
          width: 700, height: 700,
          background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 50%, transparent 70%)",
          top: -200, left: -200,
        }}
      />
      <div
        className="blob-green"
        style={{
          width: 400, height: 400,
          background: "radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)",
          bottom: 100, right: -100,
        }}
      />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-8 pt-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Zap size={13} className="text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-emerald-400 tracking-widest uppercase">FinSight</span>
          </div>
          <nav className="flex gap-6 text-xs text-emerald-800 font-medium tracking-wide">
            <button onClick={() => setActiveSection("home")} className="hover:text-emerald-400 transition-colors">Overview</button>
            <button onClick={() => setActiveSection("pipeline")} className="hover:text-emerald-400 transition-colors">Pipeline</button>
            <button onClick={() => setActiveSection("analysis")} className="hover:text-emerald-400 transition-colors">Research</button>
          </nav>
        </header>

        {/* Hero body */}
        <div className="relative flex-1 flex items-center px-8 md:px-16 gap-8 pb-32">

          {/* Left — copy + search */}
          <div className="flex-1 flex flex-col gap-8 max-w-lg z-10">
            <div>
              <p className="text-xs font-mono text-emerald-600 tracking-[0.3em] uppercase mb-4">Automated Equity Research</p>
              <h1 className="text-6xl md:text-7xl font-black leading-none tracking-tight">
                <span className="shimmer-text">Fin</span>
                <span className="text-white">Sight</span>
              </h1>
              <p className="mt-4 text-emerald-200/60 text-base leading-relaxed max-w-sm">
                SEC filings → FinBERT sentiment → FAISS RAG → analyst brief.
                <br />
                <span className="text-emerald-500/70">Zero cost. Fully local.</span>
              </p>
            </div>

            {/* Search card */}
            <div className="glass-card p-5 flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-emerald-700 uppercase tracking-widest mb-1 block">Ticker</label>
                  <input
                    value={ticker}
                    onChange={e => setTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && analyze()}
                    placeholder="AAPL"
                    className="w-full bg-transparent border border-emerald-900/60 rounded-lg px-3 py-2 text-sm text-emerald-100 placeholder-emerald-900 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-emerald-700 uppercase tracking-widest mb-1 block">Quarter</label>
                  <select
                    value={quarter}
                    onChange={e => setQuarter(e.target.value)}
                    className="w-full bg-[#060a06] border border-emerald-900/60 rounded-lg px-3 py-2 text-sm text-emerald-100 focus:outline-none focus:border-emerald-500/50"
                  >
                    {["Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025","Q3-2025","Q4-2025"].map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={analyze}
                disabled={loading || !ticker.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 transition-all disabled:opacity-40"
              >
                {loading ? (
                  <><span className="loader" />Analyzing…</>
                ) : (
                  <><Search size={14} />Run Analysis</>
                )}
              </button>
              {error && <p className="text-red-400/80 text-xs">{error}</p>}
            </div>

            {/* Quick metrics row */}
            {result && (
              <div className="flex gap-3">
                {[
                  { label: "Sentiment", value: result.sentiment.label, icon: <SentimentIcon label={result.sentiment.label} /> },
                  { label: "Guidance", value: `${result.guidance.length} signals`, icon: <Zap size={14} className="text-yellow-400" /> },
                  { label: "Risk Δ", value: `+${result.risk_delta.added.length} / -${result.risk_delta.removed.length}`, icon: <Shield size={14} className="text-emerald-400" /> },
                ].map(m => (
                  <div key={m.label} className="glass-card flex-1 p-3">
                    <div className="flex items-center gap-1.5 mb-1">{m.icon}<span className="text-[10px] text-emerald-700 uppercase tracking-wider">{m.label}</span></div>
                    <p className="text-xs font-semibold text-emerald-200">{m.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — Spline robot */}
          <div className="hidden lg:flex flex-1 items-center justify-center relative" style={{ minHeight: 520 }}>
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 460, height: 460,
                background: "radial-gradient(circle, rgba(52,211,153,0.13) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
            <div className="animate-float" style={{ width: 480, height: 480 }}>
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <span className="loader" style={{ width: 32, height: 32, borderWidth: 3 }} />
                </div>
              }>
                <SplineScene />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* ── PIPELINE — RadialOrbitalTimeline ── */}
      {(activeSection === "home" || activeSection === "pipeline") && (
        <section className="relative py-24 px-8 md:px-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-mono text-emerald-600 tracking-[0.3em] uppercase mb-3">How it works</p>
              <h2 className="text-4xl font-black text-white">Analysis Pipeline</h2>
              <p className="mt-3 text-emerald-200/50 text-sm max-w-md mx-auto">
                Click any node to inspect the stage. Connected nodes light up automatically.
              </p>
            </div>
            <div style={{ height: 520 }}>
              <RadialOrbitalTimeline timelineData={pipelineNodes} />
            </div>
          </div>
        </section>
      )}

      {/* ── ANALYSIS RESULTS ── */}
      {result && (activeSection === "analysis" || activeSection === "home") && (
        <section className="relative py-16 px-8 md:px-16">
          <div className="max-w-5xl mx-auto space-y-6">

            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-mono text-emerald-600 tracking-[0.3em] uppercase mb-1">Research Output</p>
                <h2 className="text-2xl font-black text-white">{result.ticker} · {result.quarter}</h2>
              </div>
              <SentimentTag label={result.sentiment.label} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">

              {/* Sentiment */}
              <div className="glass-card p-6">
                <h3 className="text-xs font-mono text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Brain size={12} />Sentiment Scores
                </h3>
                {(["positive","negative","neutral"] as const).map(k => (
                  <div key={k} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-emerald-400/70">{k}</span>
                      <span className="font-mono text-emerald-300">{(result.sentiment.score[k] * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 bg-emerald-950 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${result.sentiment.score[k] * 100}%`,
                          background: k === "positive" ? "#34d399" : k === "negative" ? "#f87171" : "#fbbf24",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Guidance */}
              <div className="glass-card p-6 flex flex-col gap-3">
                <h3 className="text-xs font-mono text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <Zap size={12} />Forward Guidance
                </h3>
                {result.guidance.length === 0 ? (
                  <p className="text-xs text-emerald-800">No guidance signals detected.</p>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-40">
                    {result.guidance.slice(0, 6).map((g, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <SentimentTag label={g.tag === "optimistic" ? "positive" : g.tag === "cautious" ? "negative" : "neutral"} />
                        <p className="text-xs text-emerald-200/70 leading-relaxed">{g.text.slice(0, 100)}…</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Risk delta */}
              <div className="glass-card p-6">
                <h3 className="text-xs font-mono text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Shield size={12} />Risk Factor Delta
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center mb-4">
                  {[
                    { label: "Added", count: result.risk_delta.added.length, color: "text-emerald-400" },
                    { label: "Removed", count: result.risk_delta.removed.length, color: "text-red-400" },
                    { label: "Modified", count: result.risk_delta.modified.length, color: "text-yellow-400" },
                  ].map(d => (
                    <div key={d.label} className="glass-card p-3">
                      <p className={`text-2xl font-black ${d.color}`}>{d.count}</p>
                      <p className="text-[10px] text-emerald-800 uppercase tracking-wide">{d.label}</p>
                    </div>
                  ))}
                </div>
                {result.risk_delta.added.slice(0, 2).map((s, i) => (
                  <div key={i} className="flex gap-2 items-start mb-2">
                    <span className="text-emerald-500 text-xs font-mono mt-0.5">+</span>
                    <p className="text-xs text-emerald-200/60 leading-relaxed">{s.slice(0, 120)}…</p>
                  </div>
                ))}
              </div>

              {/* Brief */}
              <div className="glass-card p-6">
                <h3 className="text-xs font-mono text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileText size={12} />Analyst Brief
                </h3>
                <p className="text-xs text-emerald-200/70 leading-relaxed line-clamp-6">{result.brief}</p>
                <button className="mt-4 flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-300 transition-colors">
                  Full report <ChevronRight size={12} />
                </button>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM DOCK ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="dock-glass px-4 py-2.5 flex items-center gap-1">
          {dockItems.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              title={label}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${activeSection === id
                  ? "bg-emerald-500/25 text-emerald-300 shadow-lg shadow-emerald-500/20"
                  : "text-emerald-800 hover:text-emerald-500 hover:bg-emerald-900/30"}
              `}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>

      {/* ── CHATBOT ── */}
      <Chatbot />

    </div>
  );
}
