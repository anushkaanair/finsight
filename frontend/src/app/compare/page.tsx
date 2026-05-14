"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, ArrowLeft, Plus, X, Search, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { compareTickersAPI } from "@/lib/api";
import type { CompareResult, CompareEntry } from "@/types/brief";

const C = {
  bg:       "#05080A",
  surface:  "rgba(11,15,19,0.96)",
  accent:   "#00997A",
  accentHi: "#00BF92",
  pos:      "#00CC7A",
  neg:      "#E04055",
  neu:      "#D48F00",
  border:   "rgba(0,140,95,0.12)",
  borderHi: "rgba(0,140,95,0.28)",
  text:     "#C4D4DC",
  muted:    "rgba(170,195,210,0.38)",
};

const QUARTERS = [
  "Q1-2023","Q2-2023","Q3-2023","Q4-2023",
  "Q1-2024","Q2-2024","Q3-2024","Q4-2024",
  "Q1-2025","Q2-2025",
];

const PRESETS = [
  { label: "FAANG",    tickers: ["AAPL","AMZN","META","GOOGL","NFLX"] },
  { label: "Big Tech", tickers: ["MSFT","AAPL","NVDA","GOOGL","META"] },
  { label: "Banks",    tickers: ["JPM","BAC","GS","MS","C"] },
  { label: "EV",       tickers: ["TSLA","RIVN","NIO","LCID"] },
];

function SentimentBar({ label, score }: { label: string; score: { positive: number; negative: number; neutral: number } }) {
  const c = { positive: C.pos, negative: C.neg, neutral: C.neu }[label] || C.accentHi;
  const pct = (score[label as keyof typeof score] * 100).toFixed(0);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: C.muted, textTransform: "capitalize" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: c }}>{pct}%</span>
      </div>
      <div style={{ height: 2, background: "rgba(0,140,95,0.07)", borderRadius: 2 }}>
        <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: c, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

function CompareCard({ ticker, entry }: { ticker: string; entry: CompareEntry }) {
  const lbl = entry.sentiment.label;
  const sentColor = { positive: C.pos, negative: C.neg, neutral: C.neu }[lbl] || C.accentHi;
  const sentIcon = lbl === "positive" ? <TrendingUp size={13} color={C.pos} /> : lbl === "negative" ? <TrendingDown size={13} color={C.neg} /> : <Minus size={13} color={C.neu} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Card header */}
      <div style={{
        padding: "16px 20px",
        background: "rgba(0,0,0,0.3)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: C.text, letterSpacing: "0.06em" }}>{ticker}</div>
          {entry.market?.price && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: C.accentHi, marginTop: 2 }}>
              ${entry.market.price.toFixed(2)}
              {entry.market.pe_ratio && <span style={{ color: C.muted, marginLeft: 10 }}>P/E {entry.market.pe_ratio.toFixed(1)}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {sentIcon}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: sentColor, fontWeight: 700 }}>{lbl.toUpperCase()}</span>
        </div>
      </div>

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>

        {/* Sentiment bars */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 10 }}>SENTIMENT</p>
          <SentimentBar label="positive" score={entry.sentiment.score} />
          <SentimentBar label="negative" score={entry.sentiment.score} />
          <SentimentBar label="neutral"  score={entry.sentiment.score} />
        </div>

        {/* Risk */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 10 }}>RISK Δ</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: C.neg }}>{entry.risk_added}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: C.muted, marginTop: 3 }}>ADDED</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: C.pos }}>{entry.risk_removed}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: C.muted, marginTop: 3 }}>REMOVED</div>
            </div>
          </div>
        </div>

        {/* Guidance */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 10 }}>GUIDANCE</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { l: "OPT", n: entry.optimistic_count, c: C.pos },
              { l: "CAU", n: entry.cautious_count,   c: C.neg },
              { l: "NEU", n: entry.guidance_count - entry.optimistic_count - entry.cautious_count, c: C.neu },
            ].map(d => (
              <div key={d.l} style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: d.c }}>{Math.max(0, d.n)}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: C.muted, marginTop: 2 }}>{d.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Financials */}
        {entry.financials?.available && (
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 10 }}>FINANCIALS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { l: "Revenue",     v: entry.financials.revenue },
                { l: "Net Income",  v: entry.financials.net_income },
                { l: "Gross Margin",v: entry.financials.gross_margin },
                { l: "EPS Diluted", v: entry.financials.eps_diluted ? `$${entry.financials.eps_diluted}` : undefined },
              ].filter(m => m.v).map(m => (
                <div key={m.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid rgba(0,140,95,0.07)` }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: C.muted }}>{m.l}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: C.accentHi, fontWeight: 700 }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brief */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 8 }}>BRIEF</p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>{entry.brief.slice(0, 200)}…</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function ComparePage() {
  const [tickers,  setTickers]  = useState<string[]>(["AAPL", "MSFT"]);
  const [input,    setInput]    = useState("");
  const [quarter,  setQuarter]  = useState("Q1-2024");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<CompareResult | null>(null);
  const [err,      setErr]      = useState("");

  function addTicker() {
    const t = input.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= 4) return;
    setTickers(p => [...p, t]);
    setInput("");
  }

  function removeTicker(t: string) {
    setTickers(p => p.filter(x => x !== t));
  }

  async function compare() {
    if (tickers.length < 2) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const r = await compareTickersAPI(tickers, quarter);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "76px 52px 80px" }}>
      <div className="bg-grid" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />

      {/* Header */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "rgba(5,8,10,0.94)", backdropFilter: "blur(24px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 44px", gap: 16, zIndex: 40 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em" }}>
          <ArrowLeft size={13} /> BACK
        </Link>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <Zap size={13} color={C.accentHi} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.2em", color: C.text }}>FINSIGHT</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.16em", color: C.muted }}>· MULTI-TICKER COMPARISON</span>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto" }}>

        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <BarChart2 size={18} color={C.accentHi} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: "0.1em", color: C.text }}>SIDE-BY-SIDE ANALYSIS</h1>
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: C.muted }}>
            Compare up to 4 tickers simultaneously — sentiment, risk delta, guidance signals, and financial metrics.
          </p>
        </div>

        {/* Controls */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>

          {/* Presets */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", color: C.muted, alignSelf: "center" }}>PRESETS</span>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setTickers(p.tickers.slice(0, 4))} style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 12px", border: `1px solid ${C.border}`, borderRadius: 4, background: "transparent", color: C.muted, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = C.borderHi; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >{p.label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            {/* Ticker chips */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 8 }}>
                TICKERS ({tickers.length}/4)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {tickers.map(t => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,153,122,0.1)", border: `1px solid ${C.borderHi}`, borderRadius: 20, padding: "4px 12px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: C.accentHi, fontWeight: 700 }}>{t}</span>
                    <button onClick={() => removeTicker(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                      <X size={11} color={C.muted} />
                    </button>
                  </div>
                ))}
                {tickers.length < 4 && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={input} onChange={e => setInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && addTicker()}
                      placeholder="ADD TICKER"
                      style={{ width: 110, background: "rgba(0,0,0,0.5)", border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: C.text, outline: "none", letterSpacing: "0.08em" }}
                    />
                    <button onClick={addTicker} style={{ background: "rgba(0,153,122,0.1)", border: `1px solid ${C.borderHi}`, borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Plus size={13} color={C.accentHi} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quarter */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)", marginBottom: 8 }}>QUARTER</div>
              <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 11, color: C.text, outline: "none" }}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>

            {/* Compare button */}
            <button onClick={compare} disabled={loading || tickers.length < 2} style={{
              background: "rgba(0,153,122,0.12)", border: `1px solid ${C.borderHi}`,
              borderRadius: 6, padding: "10px 24px",
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
              color: C.accentHi, cursor: tickers.length < 2 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 8, opacity: tickers.length < 2 ? 0.4 : 1,
            }}>
              {loading ? <><span className="loader" /> ANALYZING…</> : <><Search size={12} /> COMPARE</>}
            </button>
          </div>

          {err && <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: C.neg, marginTop: 10 }}>✗ {err}</p>}
        </div>

        {/* Error per ticker */}
        {result && Object.keys(result.errors).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {Object.entries(result.errors).map(([t, e]) => (
              <p key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: C.neg }}>
                ✗ {t}: {e}
              </p>
            ))}
          </div>
        )}

        {/* Results grid */}
        {result && Object.keys(result.results).length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Object.keys(result.results).length}, 1fr)`,
            gap: 14,
          }}>
            {Object.entries(result.results).map(([ticker, entry]) => (
              <CompareCard key={ticker} ticker={ticker} entry={entry} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <BarChart2 size={32} color="rgba(0,153,122,0.2)" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: C.muted, letterSpacing: "0.14em" }}>
              SELECT TICKERS AND CLICK COMPARE TO BEGIN
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
