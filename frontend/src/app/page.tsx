"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Menu, Zap, FileText, Send, Brain,
  ChevronRight, Star, StarOff, Clock, TrendingUp,
  TrendingDown, Minus, BarChart2, Shield, Home,
  Database, MessageCircle, ExternalLink, RefreshCw,
} from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import {
  runAnalysis, sendChatMessage, fetchHistory,
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
} from "@/lib/api";
import type {
  AnalysisResult, ChatMessage, HistoryItem, WatchlistItem,
} from "@/types/brief";

/* ─── colour system ──────────────────────────────────────── */
const C = {
  bg:       "#05080A",
  surface:  "rgba(11,15,19,0.96)",
  surface2: "rgba(8,12,16,0.98)",
  accent:   "#00997A",
  accentHi: "#00BF92",
  pos:      "#00CC7A",
  neg:      "#E04055",
  neu:      "#D48F00",
  border:   "rgba(0,140,95,0.12)",
  borderHi: "rgba(0,140,95,0.28)",
  text:     "#C4D4DC",
  muted:    "rgba(170,195,210,0.38)",
  blue:     "#4A9EFF",
};

const BAR: Record<string, string> = {
  positive: C.pos, negative: C.neg, neutral: C.neu,
};
const TAG: Record<string, React.CSSProperties> = {
  optimistic: { background: "rgba(0,204,122,0.09)", border: `1px solid rgba(0,204,122,0.22)`, color: C.pos },
  cautious:   { background: "rgba(224,64,85,0.09)",  border: `1px solid rgba(224,64,85,0.22)`,  color: C.neg },
  neutral:    { background: "rgba(212,143,0,0.09)",  border: `1px solid rgba(212,143,0,0.22)`,  color: C.neu },
};

const S = {
  panel: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    backdropFilter: "blur(20px)",
  } as React.CSSProperties,
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 9, letterSpacing: "0.24em",
    color: "rgba(0,153,122,0.52)",
    textTransform: "uppercase" as const,
    marginBottom: 12,
  } as React.CSSProperties,
  muted: {
    fontFamily: "var(--font-sans)",
    color: C.muted,
  } as React.CSSProperties,
};

function fmtMarketCap(n: number | null) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

/* ══════════════════════════════════════════════════════════ */
export default function Page() {
  /* ── state ── */
  const [ticker,   setTicker]   = useState("");
  const [quarter,  setQuarter]  = useState("Q1-2024");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<AnalysisResult | null>(null);
  const [err,      setErr]      = useState("");
  const [navOpen,  setNavOpen]  = useState(false);
  const [activeTab,setActiveTab]= useState<"overview"|"risk"|"guidance"|"financials"|"market">("overview");

  /* chat */
  const [chatOpen,    setChatOpen]    = useState(false);
  const [msgs,        setMsgs]        = useState<ChatMessage[]>([
    { role: "assistant", content: "Analyst ready. Run a ticker analysis then ask me anything about the filing." },
  ]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatCtx,     setChatCtx]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  /* history / watchlist */
  const [history,   setHistory]   = useState<HistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [sidePanel, setSidePanel] = useState<"history"|"watchlist"|null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, chatOpen]);

  const loadHistory = useCallback(async () => {
    const h = await fetchHistory(15);
    setHistory(h);
  }, []);

  const loadWatchlist = useCallback(async () => {
    const w = await fetchWatchlist();
    setWatchlist(w);
    if (ticker) setInWatchlist(w.some(i => i.ticker === ticker.toUpperCase()));
  }, [ticker]);

  useEffect(() => { loadHistory(); loadWatchlist(); }, [loadHistory, loadWatchlist]);

  /* ── analyze ── */
  async function analyze() {
    if (!ticker.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const r = await runAnalysis(ticker.trim().toUpperCase(), quarter);
      setResult(r);
      setChatCtx(r.brief);
      setActiveTab("overview");
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      loadHistory();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connection failed — is Flask running?");
    } finally {
      setLoading(false);
    }
  }

  /* ── chat ── */
  async function sendChat() {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setMsgs(p => [...p, { role: "user", content: q }]);
    setChatLoading(true);
    try {
      const res = await sendChatMessage(q, ticker, chatCtx);
      setMsgs(p => [...p, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Flask not reachable on port 5000." }]);
    } finally {
      setChatLoading(false);
    }
  }

  /* ── watchlist toggle ── */
  async function toggleWatchlist() {
    if (!ticker.trim()) return;
    const t = ticker.trim().toUpperCase();
    if (inWatchlist) {
      await removeFromWatchlist(t);
      setInWatchlist(false);
    } else {
      await addToWatchlist(t);
      setInWatchlist(true);
    }
    loadWatchlist();
  }

  const sentTrend = result?.sentiment?.trend;

  /* ════════════════════════ RENDER ══════════════════════ */
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: C.bg, overflowX: "hidden" }}>

      {/* Grid texture */}
      <div className="bg-grid" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5 }} />

      {/* Subtle corner glows */}
      <div style={{ position:"fixed", top:-320, left:-320, zIndex:0, pointerEvents:"none", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,140,95,0.06) 0%, transparent 65%)", filter:"blur(70px)" }} />
      <div style={{ position:"fixed", bottom:-220, right:-220, zIndex:0, pointerEvents:"none", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,100,70,0.05) 0%, transparent 65%)", filter:"blur(60px)" }} />

      {/* ══ HEADER ══ */}
      <header style={{
        position:"fixed", top:0, left:0, right:0, zIndex:40, height:56,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 44px",
        background:"rgba(5,8,10,0.94)", backdropFilter:"blur(24px)",
        borderBottom:`1px solid ${C.border}`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:"rgba(0,153,122,0.08)", border:`1px solid rgba(0,153,122,0.22)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={12} color={C.accentHi} />
          </div>
          <span style={{ fontFamily:"var(--font-display)", fontSize:19, letterSpacing:"0.22em", color:C.text }}>FINSIGHT</span>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.16em", color:C.muted, paddingLeft:8, borderLeft:`1px solid ${C.border}`, marginLeft:4 }}>EQUITY INTELLIGENCE</span>
        </div>

        <nav style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* History */}
          <button onClick={() => setSidePanel(p => p==="history" ? null : "history")} style={{
            display:"flex", alignItems:"center", gap:5,
            fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color: sidePanel==="history" ? C.accentHi : C.muted,
            background: sidePanel==="history" ? "rgba(0,153,122,0.08)" : "none",
            border:`1px solid ${sidePanel==="history" ? C.borderHi : "transparent"}`,
            borderRadius:4, padding:"5px 10px", cursor:"pointer",
          }}>
            <Clock size={11} /> HISTORY
          </button>

          {/* Watchlist */}
          <button onClick={() => setSidePanel(p => p==="watchlist" ? null : "watchlist")} style={{
            display:"flex", alignItems:"center", gap:5,
            fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color: sidePanel==="watchlist" ? C.accentHi : C.muted,
            background: sidePanel==="watchlist" ? "rgba(0,153,122,0.08)" : "none",
            border:`1px solid ${sidePanel==="watchlist" ? C.borderHi : "transparent"}`,
            borderRadius:4, padding:"5px 10px", cursor:"pointer",
          }}>
            <Star size={11} /> WATCHLIST {watchlist.length > 0 && `(${watchlist.length})`}
          </button>

          {/* Compare link */}
          <a href="/compare" style={{
            display:"flex", alignItems:"center", gap:5,
            fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color:C.muted,
            border:`1px solid transparent`, borderRadius:4, padding:"5px 10px",
            textDecoration:"none",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accentHi; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}
          >
            <BarChart2 size={11} /> COMPARE
          </a>
        </nav>

        <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color:"rgba(0,153,122,0.5)", padding:"4px 10px", border:`1px solid ${C.border}`, borderRadius:4 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
          SYSTEM ONLINE
        </div>
      </header>

      {/* ══ SIDE PANEL — History / Watchlist ══ */}
      <AnimatePresence>
        {sidePanel && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            style={{
              position:"fixed", top:56, right:0, bottom:0, zIndex:38,
              width:300, background:C.surface2,
              borderLeft:`1px solid ${C.border}`,
              overflowY:"auto", padding:"20px 0",
            }}
          >
            {/* Panel header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 18px 16px", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.2em", color:C.accentHi }}>
                {sidePanel === "history" ? "RECENT ANALYSES" : "WATCHLIST"}
              </span>
              <button onClick={() => setSidePanel(null)} style={{ background:"none", border:"none", cursor:"pointer" }}>
                <X size={13} color={C.muted} />
              </button>
            </div>

            {/* History list */}
            {sidePanel === "history" && (
              <div style={{ padding:"12px 0" }}>
                {history.length === 0 && (
                  <p style={{ ...S.muted, fontSize:11, padding:"0 18px" }}>No analyses yet.</p>
                )}
                {history.map((h, i) => (
                  <button key={i} onClick={() => {
                    setTicker(h.ticker);
                    setQuarter(h.quarter);
                    setSidePanel(null);
                  }} style={{
                    width:"100%", textAlign:"left", padding:"10px 18px",
                    background:"none", border:"none", cursor:"pointer",
                    borderBottom:`1px solid ${C.border}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,153,122,0.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:C.text, fontWeight:700 }}>{h.ticker}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color: BAR[h.sentiment_label] || C.muted, letterSpacing:"0.1em" }}>
                        {h.sentiment_label?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:C.muted }}>{h.quarter}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>
                        {new Date(h.generated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Watchlist */}
            {sidePanel === "watchlist" && (
              <div style={{ padding:"12px 0" }}>
                {watchlist.length === 0 && (
                  <p style={{ ...S.muted, fontSize:11, padding:"12px 18px" }}>
                    No tickers in watchlist. Run an analysis and click the ★ to add.
                  </p>
                )}
                {watchlist.map((w, i) => (
                  <div key={i} style={{ padding:"10px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:C.text, fontWeight:700 }}>{w.ticker}</span>
                        {w.sentiment_label && (
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color: BAR[w.sentiment_label] || C.muted }}>
                            {w.sentiment_label.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {w.last_quarter && (
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>Last: {w.last_quarter}</span>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => { setTicker(w.ticker); setSidePanel(null); }} style={{ background:"none", border:"none", cursor:"pointer" }}>
                        <ExternalLink size={12} color={C.muted} />
                      </button>
                      <button onClick={async () => { await removeFromWatchlist(w.ticker); loadWatchlist(); }} style={{ background:"none", border:"none", cursor:"pointer" }}>
                        <X size={12} color={C.muted} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO ══ */}
      <section style={{
        position:"relative", zIndex:1,
        minHeight:"100vh", padding:"96px 52px 80px",
        display:"flex", alignItems:"center",
        paddingRight:"460px",
      }}>
        <div style={{ maxWidth:560, width:"100%", display:"flex", flexDirection:"column", gap:24 }}>

          {/* Eyebrow */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 12px", border:`1px solid ${C.border}`, borderRadius:4, width:"fit-content" }}>
            <span style={{ width:4, height:4, borderRadius:"50%", background:C.accentHi, display:"inline-block" }} />
            <span style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.28em", color:"rgba(0,153,122,0.55)", textTransform:"uppercase" }}>
              SEC EDGAR · FINBERT · GROQ AI · FAISS RAG
            </span>
          </div>

          {/* Heading */}
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(58px,7.2vw,100px)", lineHeight:0.9, letterSpacing:"0.02em", color:C.text }}>
            AUTOMATED<br />
            <span style={{ color:C.accentHi }}>EQUITY</span><br />
            RESEARCH
          </h1>

          <div style={{ width:48, height:1, background:`linear-gradient(90deg, ${C.accentHi}, transparent)` }} />

          <p style={{ ...S.muted, fontSize:13, lineHeight:1.85, maxWidth:420, color:"rgba(170,195,210,0.5)" }}>
            Ingest 10-K / 10-Q filings from SEC EDGAR. Score sentiment with FinBERT,
            detect Q-over-Q risk changes, extract financial metrics, and get
            Groq AI analyst answers — fully free, zero paid APIs.
          </p>

          {/* ── Form ── */}
          <div style={{ ...S.panel, padding:22 }}>
            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <label style={{ ...S.label, marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
                  Stock Ticker
                  <span title="E.g. AAPL, MSFT, NVDA, JPM, TSLA" style={{ cursor:"help", color:C.border, fontSize:11 }}>ⓘ</span>
                </label>
                <div style={{ display:"flex", gap:6 }}>
                  <input
                    value={ticker}
                    onChange={e => setTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && analyze()}
                    placeholder="AAPL · MSFT · NVDA"
                    style={{ flex:1, background:"rgba(0,0,0,0.6)", border:`1px solid ${C.border}`, borderRadius:6, padding:"9px 13px", fontFamily:"var(--font-mono)", fontSize:13, color:C.text, outline:"none", letterSpacing:"0.06em" }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.borderHi)}
                    onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {/* Watchlist star */}
                  {ticker && (
                    <button onClick={toggleWatchlist} title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"} style={{
                      background: inWatchlist ? "rgba(0,153,122,0.12)" : "transparent",
                      border:`1px solid ${inWatchlist ? C.borderHi : C.border}`,
                      borderRadius:6, padding:"0 11px", cursor:"pointer",
                    }}>
                      {inWatchlist
                        ? <Star size={13} color={C.accentHi} fill={C.accentHi} />
                        : <StarOff size={13} color={C.muted} />
                      }
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={{ ...S.label, marginBottom:6 }}>Quarter</label>
                <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:"9px 10px", fontFamily:"var(--font-mono)", fontSize:11, color:C.text, outline:"none" }}>
                  {["Q1-2023","Q2-2023","Q3-2023","Q4-2023","Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025"].map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={analyze} disabled={loading || !ticker.trim()} style={{
              width:"100%",
              background: loading || !ticker.trim() ? "rgba(0,153,122,0.04)" : "rgba(0,153,122,0.10)",
              border:`1px solid ${loading || !ticker.trim() ? C.border : C.borderHi}`,
              borderRadius:6, padding:"12px 0",
              fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.18em",
              color: loading || !ticker.trim() ? C.muted : C.accentHi,
              cursor: loading || !ticker.trim() ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              transition:"all 0.18s",
            }}>
              {loading ? <><span className="loader" /> FETCHING FROM SEC EDGAR…</> : <><Search size={12} /> RUN ANALYSIS</>}
            </button>

            {err && <p style={{ fontFamily:"var(--font-mono)", fontSize:9, color:C.neg, marginTop:8, letterSpacing:"0.08em" }}>✗ {err}</p>}

            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:12 }}>
              <ChevronRight size={9} color={C.muted} />
              <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted, letterSpacing:"0.14em" }}>QUICK SELECT</span>
              {["AAPL","MSFT","NVDA","JPM","TSLA"].map(t => (
                <button key={t} onClick={() => setTicker(t)} style={{ fontFamily:"var(--font-mono)", fontSize:9, padding:"2px 8px", border:`1px solid ${C.border}`, borderRadius:3, background:"transparent", color:C.muted, cursor:"pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.borderColor = C.borderHi; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Summary chips */}
          {result && (
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} style={{ display:"flex", gap:8 }}>
              {[
                { k:"SENTIMENT", v:result.sentiment.label.toUpperCase(), c:BAR[result.sentiment.label]||C.accentHi },
                { k:"GUIDANCE",  v:`${result.guidance.length} SIGNALS`,  c:C.neu },
                { k:"RISK Δ",    v:`+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`, c:C.pos },
              ].map(m => (
                <div key={m.k} style={{ ...S.panel, flex:1, padding:"11px 13px" }}>
                  <div style={{ ...S.label, marginBottom:5 }}>{m.k}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:12, color:m.c, fontWeight:700 }}>{m.v}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ══ RESULTS (full-width below hero) ══ */}
      <AnimatePresence>
        {result && (
          <motion.section
            ref={resultsRef}
            initial={{ opacity:0, y:30 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.4 }}
            style={{
              position:"relative", zIndex:1,
              background:"rgba(3,5,7,0.98)",
              borderTop:`1px solid ${C.border}`,
              minHeight:"100vh",
              paddingBottom:120,
            }}
          >
            {/* Results header */}
            <div style={{ padding:"28px 52px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block" }} />
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.22em", color:"rgba(0,153,122,0.5)" }}>
                  ANALYSIS REPORT — {result.ticker} · {result.quarter}
                </span>
                {sentTrend === "up" && <TrendingUp size={14} color={C.pos} />}
                {sentTrend === "down" && <TrendingDown size={14} color={C.neg} />}
                {sentTrend === "flat" && <Minus size={14} color={C.neu} />}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>
                  {new Date(result.generated_at).toLocaleString()}
                </span>
                <button onClick={analyze} style={{ display:"flex", alignItems:"center", gap:5, fontFamily:"var(--font-mono)", fontSize:8, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 9px", cursor:"pointer" }}>
                  <RefreshCw size={10} /> REFRESH
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:0, padding:"16px 52px 0", borderBottom:`1px solid ${C.border}` }}>
              {(["overview","risk","guidance","financials","market"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.14em",
                  textTransform:"uppercase", padding:"8px 18px",
                  color: activeTab===tab ? C.accentHi : C.muted,
                  background:"none", border:"none",
                  borderBottom: activeTab===tab ? `2px solid ${C.accentHi}` : "2px solid transparent",
                  cursor:"pointer", transition:"all 0.18s",
                }}>{tab}</button>
              ))}
            </div>

            <div style={{ padding:"24px 52px" }}>

              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, maxWidth:1000 }}>

                  {/* Sentiment */}
                  <div style={{ ...S.panel, padding:22 }}>
                    <p style={S.label}>FINBERT NLP SENTIMENT</p>
                    {(["positive","negative","neutral"] as const).map(k => (
                      <div key={k} style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <span style={{ ...S.muted, fontSize:10, textTransform:"capitalize" }}>{k}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:BAR[k] }}>{(result.sentiment.score[k]*100).toFixed(1)}%</span>
                        </div>
                        <div style={{ height:2, background:"rgba(0,140,95,0.07)", borderRadius:2 }}>
                          <div style={{ height:"100%", borderRadius:2, width:`${result.sentiment.score[k]*100}%`, background:BAR[k], transition:"width 1.4s ease" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ ...S.label, marginBottom:0 }}>VERDICT</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:BAR[result.sentiment.label]||C.accentHi, letterSpacing:"0.1em" }}>
                        {result.sentiment.label.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Brief */}
                  <div style={{ ...S.panel, padding:22 }}>
                    <p style={S.label}>ANALYST BRIEF</p>
                    <p style={{ ...S.muted, fontSize:12, lineHeight:1.9, color:"rgba(170,195,210,0.62)" }}>{result.brief}</p>
                    <button style={{ marginTop:14, fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.16em", color:C.accentHi, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, opacity:0.7 }}>
                      <FileText size={10} /> EXPORT PDF REPORT
                    </button>
                  </div>

                  {/* Risk summary */}
                  <div style={{ ...S.panel, padding:22 }}>
                    <p style={S.label}>RISK SNAPSHOT</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                      {[
                        { l:"Added",    n:result.risk_delta.added.length,    c:C.neg },
                        { l:"Removed",  n:result.risk_delta.removed.length,  c:C.pos },
                        { l:"Modified", n:result.risk_delta.modified.length, c:C.neu },
                      ].map(d => (
                        <div key={d.l} style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${C.border}`, borderRadius:6, padding:"13px 8px", textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:26, fontWeight:700, color:d.c }}>{d.n}</div>
                          <div style={{ ...S.muted, fontSize:8, marginTop:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>{d.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Guidance summary */}
                  <div style={{ ...S.panel, padding:22 }}>
                    <p style={S.label}>GUIDANCE SUMMARY</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
                      {[
                        { l:"Optimistic", n:result.guidance.filter(g=>g.tag==="optimistic").length, c:C.pos },
                        { l:"Cautious",   n:result.guidance.filter(g=>g.tag==="cautious").length,   c:C.neg },
                        { l:"Neutral",    n:result.guidance.filter(g=>g.tag==="neutral").length,    c:C.neu },
                      ].map(d => (
                        <div key={d.l} style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${C.border}`, borderRadius:6, padding:"13px 8px", textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:24, fontWeight:700, color:d.c }}>{d.n}</div>
                          <div style={{ ...S.muted, fontSize:8, marginTop:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>{d.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── RISK TAB ── */}
              {activeTab === "risk" && (
                <div style={{ maxWidth:900 }}>
                  <div style={{ ...S.panel, padding:22, marginBottom:14 }}>
                    <p style={S.label}>NEW RISK FACTORS — {result.risk_delta.added.length} ADDED</p>
                    {result.risk_delta.added.length === 0
                      ? <p style={{ ...S.muted, fontSize:11 }}>No new risk factors vs prior quarter.</p>
                      : result.risk_delta.added.map((s,i) => (
                          <div key={i} style={{ display:"flex", gap:10, marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
                            <span style={{ color:C.neg, fontFamily:"var(--font-mono)", fontSize:11, flexShrink:0, marginTop:1 }}>+</span>
                            <p style={{ ...S.muted, fontSize:12, lineHeight:1.65 }}>{s}</p>
                          </div>
                        ))
                    }
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                    <div style={{ ...S.panel, padding:22 }}>
                      <p style={S.label}>REMOVED — {result.risk_delta.removed.length}</p>
                      {result.risk_delta.removed.length === 0
                        ? <p style={{ ...S.muted, fontSize:11 }}>None removed.</p>
                        : result.risk_delta.removed.slice(0,5).map((s,i) => (
                            <div key={i} style={{ display:"flex", gap:8, marginBottom:10 }}>
                              <span style={{ color:C.pos, fontFamily:"var(--font-mono)", fontSize:11, flexShrink:0 }}>−</span>
                              <p style={{ ...S.muted, fontSize:11, lineHeight:1.6 }}>{s.slice(0,150)}{s.length>150?"…":""}</p>
                            </div>
                          ))
                      }
                    </div>
                    <div style={{ ...S.panel, padding:22 }}>
                      <p style={S.label}>MODIFIED — {result.risk_delta.modified.length}</p>
                      {result.risk_delta.modified.length === 0
                        ? <p style={{ ...S.muted, fontSize:11 }}>None modified.</p>
                        : result.risk_delta.modified.slice(0,3).map(([o,n],i) => (
                            <div key={i} style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
                              <p style={{ ...S.muted, fontSize:10, color:C.neg, marginBottom:4 }}>BEFORE: {o.slice(0,80)}…</p>
                              <p style={{ ...S.muted, fontSize:10, color:C.pos }}>AFTER: {n.slice(0,80)}…</p>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* ── GUIDANCE TAB ── */}
              {activeTab === "guidance" && (
                <div style={{ maxWidth:800 }}>
                  <div style={{ ...S.panel, padding:22 }}>
                    <p style={S.label}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
                    {result.guidance.length === 0
                      ? <p style={{ ...S.muted, fontSize:11 }}>No forward guidance signals detected in MD&A.</p>
                      : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                          {result.guidance.map((g,i) => (
                            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
                              <span style={{ fontFamily:"var(--font-mono)", fontSize:7, padding:"3px 8px", borderRadius:3, flexShrink:0, letterSpacing:"0.12em", ...TAG[g.tag] }}>
                                {g.tag.toUpperCase()}
                              </span>
                              <p style={{ ...S.muted, fontSize:12, lineHeight:1.65, color:"rgba(170,195,210,0.65)" }}>{g.text}</p>
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                </div>
              )}

              {/* ── FINANCIALS TAB ── */}
              {activeTab === "financials" && (
                <div style={{ maxWidth:900 }}>
                  {!result.financials?.available
                    ? (
                      <div style={{ ...S.panel, padding:28, textAlign:"center" }}>
                        <p style={{ ...S.muted, fontSize:12 }}>
                          Financial table data could not be extracted from this filing.
                          SEC filings vary in format — this is more reliable on larger companies.
                        </p>
                      </div>
                    )
                    : (
                      <>
                        {/* Key metrics grid */}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:14 }}>
                          {[
                            { k:"Revenue",        v:result.financials.revenue,          c:C.accentHi },
                            { k:"Net Income",      v:result.financials.net_income,       c:C.pos },
                            { k:"Gross Profit",    v:result.financials.gross_profit,     c:C.pos },
                            { k:"Operating Inc.",  v:result.financials.operating_income, c:C.accentHi },
                            { k:"EPS (Diluted)",   v:result.financials.eps_diluted ? `$${result.financials.eps_diluted}` : undefined, c:C.accentHi },
                            { k:"EPS (Basic)",     v:result.financials.eps_basic    ? `$${result.financials.eps_basic}`    : undefined, c:C.accentHi },
                          ].filter(m => m.v).map(m => (
                            <div key={m.k} style={{ ...S.panel, padding:"18px 20px" }}>
                              <p style={{ ...S.label, marginBottom:8 }}>{m.k}</p>
                              <p style={{ fontFamily:"var(--font-mono)", fontSize:20, color:m.c, fontWeight:700 }}>{m.v}</p>
                            </div>
                          ))}
                        </div>

                        {/* Margin bars */}
                        {(result.financials.gross_margin || result.financials.operating_margin || result.financials.net_margin) && (
                          <div style={{ ...S.panel, padding:22 }}>
                            <p style={S.label}>MARGIN ANALYSIS</p>
                            {[
                              { l:"Gross Margin",     v:result.financials.gross_margin },
                              { l:"Operating Margin", v:result.financials.operating_margin },
                              { l:"Net Margin",       v:result.financials.net_margin },
                            ].filter(m => m.v).map(m => {
                              const pct = parseFloat(m.v!.replace("%",""));
                              return (
                                <div key={m.l} style={{ marginBottom:16 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                                    <span style={{ ...S.muted, fontSize:11 }}>{m.l}</span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:pct>30?C.pos:pct>15?C.accentHi:C.neu, fontWeight:700 }}>{m.v}</span>
                                  </div>
                                  <div style={{ height:4, background:"rgba(0,140,95,0.07)", borderRadius:2 }}>
                                    <div style={{ height:"100%", borderRadius:2, width:`${Math.min(pct,100)}%`, background:pct>30?C.pos:pct>15?C.accentHi:C.neu, transition:"width 1.2s ease" }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )
                  }
                </div>
              )}

              {/* ── MARKET TAB ── */}
              {activeTab === "market" && (
                <div style={{ maxWidth:800 }}>
                  {!result.market?.price
                    ? <div style={{ ...S.panel, padding:24 }}><p style={{ ...S.muted, fontSize:12 }}>Live market data unavailable.</p></div>
                    : (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
                        {[
                          { k:"PRICE",       v:`$${result.market.price?.toFixed(2)}`,      c:C.text },
                          { k:"P/E RATIO",   v:result.market.pe_ratio?.toFixed(1) ?? "—",  c:C.accentHi },
                          { k:"MARKET CAP",  v:fmtMarketCap(result.market.market_cap),      c:C.accentHi },
                          { k:"52W HIGH",    v:`$${result.market["52w_high"]?.toFixed(2)}`, c:C.pos },
                          { k:"52W LOW",     v:`$${result.market["52w_low"]?.toFixed(2)}`,  c:C.neg },
                          { k:"TICKER",      v:result.market.ticker,                         c:C.text },
                        ].map(m => (
                          <div key={m.k} style={{ ...S.panel, padding:"18px 20px" }}>
                            <p style={{ ...S.label, marginBottom:8 }}>{m.k}</p>
                            <p style={{ fontFamily:"var(--font-mono)", fontSize:20, color:m.c, fontWeight:700 }}>{m.v}</p>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ══ CHAT PANEL ══ */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity:0, y:16, scale:0.97 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:16, scale:0.97 }}
            transition={{ duration:0.22 }}
            style={{
              position:"fixed", bottom:500, right:24, zIndex:55,
              width:320, height:450,
              background:"rgba(5,8,10,0.99)",
              border:`1px solid ${C.borderHi}`,
              borderRadius:10, overflow:"hidden",
              backdropFilter:"blur(28px)",
              boxShadow:"0 20px 60px rgba(0,0,0,0.7)",
              display:"flex", flexDirection:"column",
            }}
          >
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:`1px solid ${C.border}`, background:"rgba(0,0,0,0.4)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Brain size={12} color={C.accentHi} />
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.2em", color:C.accentHi }}>FINSIGHT AI</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:7, color:C.muted, letterSpacing:"0.1em" }}>· GROQ LLAMA-3</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background:"none", border:"none", cursor:"pointer" }}>
                <X size={13} color={C.muted} />
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgs.map((m,i) => (
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{
                    maxWidth:"88%", borderRadius:7, padding:"9px 13px",
                    fontSize:12, lineHeight:1.6, fontFamily:"var(--font-sans)",
                    ...(m.role==="user"
                      ? { background:"rgba(0,153,122,0.12)", border:`1px solid rgba(0,153,122,0.22)`, color:C.text }
                      : { background:"rgba(0,0,0,0.55)", border:`1px solid ${C.border}`, color:"rgba(170,195,210,0.72)" }
                    ),
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:"flex" }}>
                  <div style={{ background:"rgba(0,0,0,0.55)", border:`1px solid ${C.border}`, borderRadius:7, padding:"11px 15px" }}>
                    <span className="loader" style={{ width:11, height:11, borderWidth:2 }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendChat()}
                placeholder="Ask about the filing…"
                style={{ flex:1, background:"rgba(0,0,0,0.65)", border:`1px solid ${C.border}`, borderRadius:6, padding:"9px 13px", fontFamily:"var(--font-sans)", fontSize:12, color:C.text, outline:"none" }}
              />
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} style={{ background:"rgba(0,153,122,0.12)", border:`1px solid ${C.borderHi}`, borderRadius:6, padding:"0 13px", cursor:"pointer", opacity:chatLoading||!chatInput.trim()?0.3:1, display:"flex", alignItems:"center" }}>
                <Send size={13} color={C.accentHi} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ROBOT — fixed bottom-right ══ */}
      <div
        onClick={() => setChatOpen(v => !v)}
        title={chatOpen ? "Close analyst" : "Ask FinSight AI (Groq)"}
        style={{
          position:"fixed", bottom:-30, right:-20, zIndex:50,
          width:480, height:520, cursor:"pointer",
          background:"transparent", overflow:"visible",
        }}
      >
        <div style={{ position:"absolute", top:"40%", left:"48%", transform:"translate(-50%,-50%)", width:240, height:240, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,153,122,0.08) 0%, transparent 70%)", filter:"blur(36px)", pointerEvents:"none" }} />

        {!chatOpen && (
          <motion.div
            initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.6 }}
            style={{
              position:"absolute", top:52, left:28, zIndex:1,
              background:"rgba(5,8,10,0.96)", border:`1px solid ${C.borderHi}`,
              borderRadius:20, padding:"6px 14px",
              fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.14em", color:C.accentHi,
              display:"flex", alignItems:"center", gap:7, pointerEvents:"none",
              boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
            ANALYST READY · GROQ AI
          </motion.div>
        )}
        <SplineScene className="w-full h-full" />
      </div>

      {/* ══ CIRCULAR NAV ══ */}
      <div style={{ position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", zIndex:48 }}>
        {[
          { icon:Home, label:"OVERVIEW", id:"home",     a:270, r:92 },
          { icon:BarChart2, label:"ANALYSIS", id:"analysis", a:234, r:92 },
          { icon:Shield, label:"RISK", id:"risk", a:306, r:92 },
          { icon:Database, label:"RESEARCH", id:"research", a:198, r:92 },
          { icon:MessageCircle, label:"CHAT", id:"chat", a:342, r:92 },
        ].map((item, i) => {
          const rad = (item.a * Math.PI) / 180;
          const x = Math.cos(rad) * item.r;
          const y = Math.sin(rad) * item.r;
          const Icon = item.icon;
          return (
            <div key={item.id} style={{
              position:"absolute", left:"50%", bottom:"50%",
              transform: navOpen ? `translate(calc(-50% + ${x}px), calc(50% + ${y}px))` : "translate(-50%, 50%)",
              opacity: navOpen ? 1 : 0, pointerEvents: navOpen ? "auto" : "none",
              transition:`transform 0.44s cubic-bezier(0.34,1.56,0.64,1) ${i*40}ms, opacity 0.22s ease ${i*28}ms`,
              zIndex:49,
            }}>
              <div style={{ position:"absolute", bottom:"calc(100% + 7px)", left:"50%", transform:"translateX(-50%)", background:"rgba(5,8,10,0.98)", border:`1px solid ${C.border}`, borderRadius:4, padding:"3px 9px", fontFamily:"var(--font-mono)", fontSize:7, letterSpacing:"0.14em", color:C.accentHi, whiteSpace:"nowrap", pointerEvents:"none", opacity:navOpen?1:0, transition:`opacity 0.18s ease ${i*40+120}ms` }}>
                {item.label}
              </div>
              <div style={{ width:42, height:42, borderRadius:"50%", background:"rgba(5,8,10,0.96)", border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", backdropFilter:"blur(16px)" }}>
                <Icon size={14} color="rgba(0,153,122,0.4)" />
              </div>
            </div>
          );
        })}
        <div onClick={() => setNavOpen(v => !v)} style={{ position:"relative", zIndex:50, width:50, height:50, borderRadius:"50%", background:navOpen?"rgba(0,153,122,0.14)":"rgba(5,8,10,0.96)", border:`1px solid ${navOpen?C.borderHi:C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", backdropFilter:"blur(20px)", boxShadow:"0 4px 20px rgba(0,0,0,0.5)", transition:"all 0.26s" }}>
          {navOpen ? <X size={16} color={C.accentHi} /> : <Menu size={16} color="rgba(0,153,122,0.5)" />}
        </div>
      </div>

    </div>
  );
}
