"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Zap, FileText, Send, Brain,
  ChevronRight, Star, StarOff, Clock, TrendingUp,
  TrendingDown, Minus, BarChart2, Shield, Home,
  Database, MessageCircle, ExternalLink, RefreshCw, Menu,
} from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import {
  runAnalysis, sendChatMessage, fetchHistory,
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
} from "@/lib/api";
import type {
  AnalysisResult, ChatMessage, HistoryItem, WatchlistItem,
} from "@/types/brief";

/* ─── Design Tokens (mirrors globals.css) ─────────────────── */
const C = {
  bg:       "#05080A",
  bg2:      "#080C0F",
  surface:  "rgba(10,14,18,0.97)",
  surface2: "rgba(14,19,24,0.95)",
  accent:   "#00C896",
  accentHi: "#00E8AA",
  accentDim:"rgba(0,200,150,0.55)",
  pos:      "#00D47A",
  neg:      "#E03B50",
  neu:      "#D4900A",
  border:   "rgba(0,150,100,0.11)",
  borderHi: "rgba(0,190,130,0.30)",
  text:     "#D0DDE5",
  text2:    "#96AABA",
  muted:    "rgba(140,170,190,0.42)",
};

const BAR: Record<string, string> = {
  positive: C.pos, negative: C.neg, neutral: C.neu,
};

const TAG: Record<string, React.CSSProperties> = {
  optimistic: { background:"rgba(0,212,122,0.09)", border:"1px solid rgba(0,212,122,0.24)", color:C.pos },
  cautious:   { background:"rgba(224,59,80,0.09)",  border:"1px solid rgba(224,59,80,0.24)",  color:C.neg },
  neutral:    { background:"rgba(212,144,10,0.09)", border:"1px solid rgba(212,144,10,0.24)", color:C.neu },
};

const S = {
  panel: {
    background: "rgba(10,14,18,0.97)",
    border: `1px solid rgba(0,150,100,0.11)`,
    borderRadius: 8,
    backdropFilter: "blur(20px)",
  } as React.CSSProperties,
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 9, letterSpacing: "0.24em",
    color: "rgba(0,200,150,0.45)",
    textTransform: "uppercase" as const,
    marginBottom: 12,
  } as React.CSSProperties,
  muted: {
    fontFamily: "var(--font-sans)",
    color: C.muted,
  } as React.CSSProperties,
};

/* ─── Animation variants ──────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
};

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtMarketCap(n: number | null) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

/* ─── Ticker tape data ────────────────────────────────────── */
const TAPE_ITEMS = [
  { t:"AAPL",  v:"$189.30", d:"+1.24%" },
  { t:"MSFT",  v:"$415.20", d:"+0.87%" },
  { t:"NVDA",  v:"$878.30", d:"+2.41%" },
  { t:"GOOGL", v:"$172.40", d:"-0.33%" },
  { t:"TSLA",  v:"$177.90", d:"-1.07%" },
  { t:"META",  v:"$507.60", d:"+0.62%" },
  { t:"JPM",   v:"$193.80", d:"+0.45%" },
  { t:"AMZN",  v:"$182.40", d:"+1.18%" },
  { t:"BRK.B", v:"$402.10", d:"+0.22%" },
  { t:"V",     v:"$277.30", d:"+0.38%" },
];

/* ══════════════════════════════════════════════════════════ */
export default function Page() {
  /* ── state ── */
  const [ticker,    setTicker]    = useState("");
  const [quarter,   setQuarter]   = useState("Q1-2024");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<AnalysisResult | null>(null);
  const [err,       setErr]       = useState("");
  const [navOpen,   setNavOpen]   = useState(false);
  const [activeTab, setActiveTab] = useState<"overview"|"risk"|"guidance"|"financials"|"market">("overview");

  /* chat */
  const [chatOpen,    setChatOpen]    = useState(true);
  const [msgs,        setMsgs]        = useState<ChatMessage[]>([
    { role:"assistant", content:"Analyst ready. Run a ticker analysis then ask me anything about the filing." },
  ]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatCtx,     setChatCtx]     = useState("");
  const bottomRef  = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  /* history / watchlist */
  const [history,     setHistory]     = useState<HistoryItem[]>([]);
  const [watchlist,   setWatchlist]   = useState<WatchlistItem[]>([]);
  const [sidePanel,   setSidePanel]   = useState<"history"|"watchlist"|null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  /* ── demo data ── */
  const DEMO_RESULT: AnalysisResult = {
    ticker:"AAPL", quarter:"Q1-2024",
    generated_at: new Date().toISOString(),
    sentiment:{ label:"positive", score:{ positive:0.71, negative:0.14, neutral:0.15 }, trend:"up" },
    guidance:[
      { text:"We expect revenue in the range of $88–92 billion driven by strong iPhone 15 demand and services growth.", tag:"optimistic", offset:0 },
      { text:"Macro headwinds and FX volatility may pressure gross margins by approximately 50 basis points.", tag:"cautious",   offset:100 },
      { text:"Services segment is projected to continue double-digit growth through fiscal 2024.", tag:"optimistic", offset:200 },
      { text:"Supply chain constraints in certain component categories remain an ongoing risk factor.", tag:"cautious",   offset:300 },
      { text:"Capital expenditures expected to remain consistent with prior year levels.", tag:"neutral",    offset:400 },
    ],
    risk_delta:{
      added:[
        "Increased EU regulatory scrutiny under the Digital Markets Act may result in significant operational changes and financial penalties.",
        "Generative AI competition integrated into Android devices could impact iPhone upgrade cycle demand in key markets.",
      ],
      removed:["COVID-19 supply chain disruptions at contract manufacturers have been largely resolved as of this period."],
      modified:[["Geopolitical tensions affecting China operations","Export control restrictions significantly affecting iPhone production in Greater China, representing 18% of net sales."]],
    },
    financials:{
      available:true, revenue:"$119.6B", net_income:"$33.9B", gross_profit:"$54.9B",
      operating_income:"$40.4B", eps_basic:"2.19", eps_diluted:"2.18",
      gross_margin:"45.9%", operating_margin:"33.8%", net_margin:"28.3%",
    },
    market:{ ticker:"AAPL", price:189.30, pe_ratio:29.4, market_cap:2920000000000, "52w_high":199.62, "52w_low":164.08 },
    brief:"Apple Q1-FY2024: $119.6B revenue (-1% YoY), EPS $2.18 beating consensus by $0.07. Services hit record $23.1B (+11% YoY). FinBERT sentiment skews positive (71%) on Services momentum and AI integration plans. Key new risks: EU DMA compliance costs and generative AI competition from Android. China exposure language hardened materially. Gross margin 45.9% remains robust. Maintain OVERWEIGHT — Services flywheel offsets hardware cyclicality.",
  };

  function loadDemo() {
    setTicker("AAPL"); setQuarter("Q1-2024");
    setResult(DEMO_RESULT);
    setChatCtx(DEMO_RESULT.brief);
    setActiveTab("overview");
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 200);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs, chatOpen]);

  const loadHistory   = useCallback(async () => { setHistory(await fetchHistory(15)); }, []);
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
      setResult(r); setChatCtx(r.brief); setActiveTab("overview");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 200);
      loadHistory();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Connection failed — is Flask running?");
    } finally { setLoading(false); }
  }

  /* ── chat ── */
  async function sendChat() {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setMsgs(p => [...p, { role:"user", content:q }]);
    setChatLoading(true);
    try {
      const res = await sendChatMessage(q, ticker, chatCtx);
      setMsgs(p => [...p, { role:"assistant", content:res.answer, sources:res.sources }]);
    } catch {
      setMsgs(p => [...p, { role:"assistant", content:"Flask not reachable on port 5000." }]);
    } finally { setChatLoading(false); }
  }

  /* ── watchlist toggle ── */
  async function toggleWatchlist() {
    if (!ticker.trim()) return;
    const t = ticker.trim().toUpperCase();
    if (inWatchlist) { await removeFromWatchlist(t); setInWatchlist(false); }
    else             { await addToWatchlist(t);       setInWatchlist(true);  }
    loadWatchlist();
  }

  const sentTrend = result?.sentiment?.trend;

  /* ════════════════════════ RENDER ══════════════════════ */
  return (
    <div style={{ position:"relative", minHeight:"100vh", background:C.bg, overflowX:"hidden" }}>

      {/* Grid texture */}
      <div className="bg-grid" style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", opacity:0.6 }} />

      {/* Ambient glows */}
      <div style={{ position:"fixed", top:-280, left:-280, zIndex:0, pointerEvents:"none", width:640, height:640, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,200,150,0.07) 0%, transparent 65%)", filter:"blur(72px)" }} />
      <div style={{ position:"fixed", bottom:-200, right:520, zIndex:0, pointerEvents:"none", width:520, height:520, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,150,100,0.06) 0%, transparent 65%)", filter:"blur(60px)" }} />

      {/* ══ HEADER ══ */}
      <header style={{
        position:"fixed", top:0, left:0, right:0, zIndex:40,
        background:"rgba(5,8,10,0.96)", backdropFilter:"blur(28px)",
        borderBottom:`1px solid ${C.border}`,
      }}>
        {/* Top bar */}
        <div style={{ height:54, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 44px" }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:7, background:"rgba(0,200,150,0.07)", border:`1px solid rgba(0,200,150,0.20)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Zap size={13} color={C.accentHi} />
            </div>
            <span style={{ fontFamily:"var(--font-display)", fontSize:20, letterSpacing:"0.26em", color:C.text, fontWeight:700 }}>FINSIGHT</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.16em", color:C.muted, paddingLeft:10, borderLeft:`1px solid ${C.border}`, marginLeft:4 }}>EQUITY INTELLIGENCE</span>
          </div>

          {/* Nav */}
          <nav style={{ display:"flex", gap:6, alignItems:"center" }}>
            {[
              { label:"HISTORY",   icon:<Clock size={11} />,    id:"history" as const },
              { label:"WATCHLIST", icon:<Star size={11} />,     id:"watchlist" as const },
            ].map(n => (
              <button key={n.id} onClick={() => setSidePanel(p => p===n.id ? null : n.id)} style={{
                display:"flex", alignItems:"center", gap:5,
                fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em",
                color: sidePanel===n.id ? C.accentHi : C.muted,
                background: sidePanel===n.id ? "rgba(0,200,150,0.07)" : "none",
                border:`1px solid ${sidePanel===n.id ? C.borderHi : "transparent"}`,
                borderRadius:4, padding:"5px 11px", cursor:"pointer", transition:"all 0.16s",
              }}>
                {n.icon}
                {n.label}
                {n.id==="watchlist" && watchlist.length>0 && (
                  <span style={{ background:"rgba(0,200,150,0.15)", color:C.accentHi, borderRadius:10, padding:"0 5px", fontSize:8 }}>{watchlist.length}</span>
                )}
              </button>
            ))}
            <a href="/compare" style={{
              display:"flex", alignItems:"center", gap:5,
              fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color:C.muted,
              border:"1px solid transparent", borderRadius:4, padding:"5px 11px",
              textDecoration:"none", transition:"all 0.16s",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color=C.accentHi; el.style.borderColor=C.border; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color=C.muted; el.style.borderColor="transparent"; }}
            >
              <BarChart2 size={11} /> COMPARE
            </a>
          </nav>

          <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.14em", color:"rgba(0,200,150,0.45)", padding:"4px 11px", border:`1px solid ${C.border}`, borderRadius:4 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
            SYSTEM ONLINE
          </div>
        </div>

        {/* Ticker tape */}
        <div style={{ height:28, borderTop:`1px solid ${C.border}`, background:"rgba(0,0,0,0.3)", overflow:"hidden", display:"flex", alignItems:"center" }}>
          <div className="ticker-wrap" style={{ flex:1 }}>
            <div className="ticker-inner" style={{ display:"inline-flex", alignItems:"center", gap:0 }}>
              {[...TAPE_ITEMS, ...TAPE_ITEMS].map((item, i) => (
                <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"0 28px", fontFamily:"var(--font-mono)", fontSize:9 }}>
                  <span style={{ color:C.accentHi, letterSpacing:"0.12em", fontWeight:700 }}>{item.t}</span>
                  <span style={{ color:C.text2 }}>{item.v}</span>
                  <span style={{ color: item.d.startsWith("+") ? C.pos : C.neg, letterSpacing:"0.06em" }}>{item.d}</span>
                  <span style={{ color:C.border, fontSize:7 }}>◆</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══ SIDE PANEL — History / Watchlist ══ */}
      <AnimatePresence>
        {sidePanel && (
          <motion.div
            initial={{ x:320, opacity:0 }}
            animate={{ x:0, opacity:1 }}
            exit={{ x:320, opacity:0 }}
            transition={{ type:"spring", damping:28, stiffness:260 }}
            style={{
              position:"fixed", top:82, right:0, bottom:0, zIndex:38,
              width:300, background:"rgba(8,12,16,0.99)",
              borderLeft:`1px solid ${C.border}`, overflowY:"auto",
            }}
          >
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.22em", color:C.accentHi }}>
                {sidePanel==="history" ? "RECENT ANALYSES" : "WATCHLIST"}
              </span>
              <button onClick={() => setSidePanel(null)} style={{ background:"none", border:"none", cursor:"pointer" }}>
                <X size={13} color={C.muted} />
              </button>
            </div>

            {sidePanel==="history" && (
              <div style={{ padding:"8px 0" }}>
                {history.length===0 && <p style={{ ...S.muted, fontSize:11, padding:"16px 18px" }}>No analyses yet.</p>}
                {history.map((h, i) => (
                  <button key={i} onClick={() => { setTicker(h.ticker); setQuarter(h.quarter); setSidePanel(null); }} style={{
                    width:"100%", textAlign:"left", padding:"11px 18px",
                    background:"none", border:"none", cursor:"pointer",
                    borderBottom:`1px solid ${C.border}`, transition:"background 0.14s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(0,200,150,0.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="none"; }}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:C.text, fontWeight:700 }}>{h.ticker}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:BAR[h.sentiment_label]||C.muted, letterSpacing:"0.1em" }}>{h.sentiment_label?.toUpperCase()}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:C.muted }}>{h.quarter}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>{new Date(h.generated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {sidePanel==="watchlist" && (
              <div style={{ padding:"8px 0" }}>
                {watchlist.length===0 && <p style={{ ...S.muted, fontSize:11, padding:"16px 18px" }}>No tickers in watchlist. Run an analysis and click ★ to add.</p>}
                {watchlist.map((w, i) => (
                  <div key={i} style={{ padding:"11px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:C.text, fontWeight:700 }}>{w.ticker}</span>
                        {w.sentiment_label && <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:BAR[w.sentiment_label]||C.muted }}>{w.sentiment_label.toUpperCase()}</span>}
                      </div>
                      {w.last_quarter && <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>Last: {w.last_quarter}</span>}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => { setTicker(w.ticker); setSidePanel(null); }} style={{ background:"none", border:"none", cursor:"pointer" }}><ExternalLink size={12} color={C.muted} /></button>
                      <button onClick={async () => { await removeFromWatchlist(w.ticker); loadWatchlist(); }} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={12} color={C.muted} /></button>
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
        minHeight:"100vh", padding:"112px 52px 80px",
        display:"flex", alignItems:"center",
        paddingRight:"460px",
      }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          style={{ maxWidth:560, width:"100%", display:"flex", flexDirection:"column", gap:22 }}
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp} transition={{ duration:0.5 }} style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"5px 13px", border:`1px solid rgba(0,200,150,0.18)`, borderRadius:4, width:"fit-content", background:"rgba(0,200,150,0.04)" }}>
            <span style={{ width:4, height:4, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
            <span style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.28em", color:"rgba(0,200,150,0.55)", textTransform:"uppercase" }}>
              SEC EDGAR · FINBERT · GROQ AI · FAISS RAG
            </span>
          </motion.div>

          {/* Heading — Syne 800 */}
          <motion.h1 variants={fadeUp} transition={{ duration:0.55 }} style={{
            fontFamily:"var(--font-display)",
            fontSize:"clamp(60px,7.5vw,104px)",
            lineHeight:0.88,
            fontWeight:800,
            letterSpacing:"0.01em",
            color:C.text,
            margin:0,
          }}>
            AUTOMATED<br />
            <span style={{ color:C.accentHi }}>EQUITY</span><br />
            RESEARCH
          </motion.h1>

          {/* Accent rule */}
          <motion.div variants={fadeUp} transition={{ duration:0.4 }} className="rule" style={{ width:64, opacity:0.6 }} />

          {/* Sub-copy */}
          <motion.p variants={fadeUp} transition={{ duration:0.5 }} style={{
            fontFamily:"var(--font-sans)", fontWeight:300,
            fontSize:13, lineHeight:1.9, maxWidth:400,
            color:"rgba(150,170,186,0.65)",
            margin:0,
          }}>
            Ingest 10-K / 10-Q filings from SEC EDGAR. Score sentiment with FinBERT,
            detect Q-over-Q risk changes, extract financial metrics, and get
            Groq AI analyst answers — fully free, zero paid APIs.
          </motion.p>

          {/* ── Form ── */}
          <motion.div variants={fadeUp} transition={{ duration:0.5 }} style={{
            ...S.panel,
            padding:22,
            borderLeft:`2px solid ${C.accent}`,
            borderRadius:"0 8px 8px 0",
          }}>
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
                    onKeyDown={e => e.key==="Enter" && analyze()}
                    placeholder="AAPL · MSFT · NVDA"
                    style={{
                      flex:1, background:"rgba(0,0,0,0.55)",
                      border:`1px solid ${C.border}`, borderRadius:6,
                      padding:"9px 14px", fontFamily:"var(--font-mono)",
                      fontSize:13, color:C.text, outline:"none", letterSpacing:"0.08em",
                      transition:"border-color 0.16s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.borderHi)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border)}
                  />
                  {ticker && (
                    <button onClick={toggleWatchlist} title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"} style={{
                      background: inWatchlist ? "rgba(0,200,150,0.10)" : "transparent",
                      border:`1px solid ${inWatchlist ? C.borderHi : C.border}`,
                      borderRadius:6, padding:"0 12px", cursor:"pointer", transition:"all 0.16s",
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
                <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{
                  background:C.bg, border:`1px solid ${C.border}`, borderRadius:6,
                  padding:"9px 10px", fontFamily:"var(--font-mono)", fontSize:11,
                  color:C.text, outline:"none",
                }}>
                  {["Q1-2023","Q2-2023","Q3-2023","Q4-2023","Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025"].map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run button */}
            <motion.button
              whileHover={{ scale: loading || !ticker.trim() ? 1 : 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={analyze}
              disabled={loading || !ticker.trim()}
              style={{
                width:"100%",
                background: loading || !ticker.trim() ? "rgba(0,200,150,0.03)" : "rgba(0,200,150,0.09)",
                border:`1px solid ${loading || !ticker.trim() ? C.border : C.borderHi}`,
                borderRadius:6, padding:"12px 0",
                fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.20em",
                color: loading || !ticker.trim() ? C.muted : C.accentHi,
                cursor: loading || !ticker.trim() ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                transition:"all 0.18s",
              }}
            >
              {loading
                ? <><span className="loader" /> FETCHING FROM SEC EDGAR…</>
                : <><Search size={12} /> RUN ANALYSIS</>
              }
            </motion.button>

            {err && (
              <p style={{ fontFamily:"var(--font-mono)", fontSize:9, color:C.neg, marginTop:8, letterSpacing:"0.08em" }}>✗ {err}</p>
            )}

            {/* Quick select */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:13, flexWrap:"wrap" }}>
              <ChevronRight size={9} color={C.muted} />
              <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted, letterSpacing:"0.14em" }}>QUICK SELECT</span>
              {["AAPL","MSFT","NVDA","JPM","TSLA"].map(t => (
                <button key={t} onClick={() => setTicker(t)} style={{
                  fontFamily:"var(--font-mono)", fontSize:9, padding:"3px 9px",
                  border:`1px solid ${C.border}`, borderRadius:3,
                  background:"transparent", color:C.muted, cursor:"pointer", transition:"all 0.14s",
                }}
                onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.color=C.text; el.style.borderColor=C.borderHi; }}
                onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.color=C.muted; el.style.borderColor=C.border; }}
                >{t}</button>
              ))}
              <div style={{ width:1, height:14, background:C.border, margin:"0 2px" }} />
              <button onClick={loadDemo} style={{
                fontFamily:"var(--font-mono)", fontSize:9, padding:"3px 11px",
                border:`1px solid rgba(0,232,170,0.35)`,
                borderRadius:3, background:"rgba(0,232,170,0.07)",
                color:C.accentHi, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.14s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="rgba(0,232,170,0.12)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="rgba(0,232,170,0.07)"; }}
              >⚡ DEMO</button>
            </div>
          </motion.div>

          {/* Summary chips */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:10 }} transition={{ duration:0.35 }}
                style={{ display:"flex", gap:8 }}
              >
                {[
                  { k:"SENTIMENT", v:result.sentiment.label.toUpperCase(), c:BAR[result.sentiment.label]||C.accentHi },
                  { k:"GUIDANCE",  v:`${result.guidance.length} SIGNALS`,  c:C.neu },
                  { k:"RISK Δ",    v:`+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`, c:C.pos },
                ].map(m => (
                  <div key={m.k} style={{ ...S.panel, flex:1, padding:"12px 14px" }}>
                    <div style={{ ...S.label, marginBottom:6 }}>{m.k}</div>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:m.c, fontWeight:700, letterSpacing:"0.04em" }}>{m.v}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ══ RESULTS (full-width below hero) ══ */}
      <AnimatePresence>
        {result && (
          <motion.section
            ref={resultsRef}
            initial={{ opacity:0, y:40 }}
            animate={{ opacity:1, y:0 }}
            transition={{ duration:0.45, ease:"easeOut" }}
            style={{
              position:"relative", zIndex:1,
              background:"rgba(3,5,7,0.99)",
              borderTop:`1px solid ${C.border}`,
              minHeight:"100vh", paddingBottom:120,
            }}
          >
            {/* Results header bar */}
            <div style={{ padding:"26px 52px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
                <span style={{ fontFamily:"var(--font-display)", fontSize:13, letterSpacing:"0.18em", color:C.text2, fontWeight:600 }}>
                  {result.ticker}
                </span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.18em", color:C.muted }}>
                  · {result.quarter} · ANALYSIS REPORT
                </span>
                {sentTrend==="up"   && <TrendingUp   size={14} color={C.pos} />}
                {sentTrend==="down" && <TrendingDown size={14} color={C.neg} />}
                {sentTrend==="flat" && <Minus        size={14} color={C.neu} />}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:8, color:C.muted }}>
                  {new Date(result.generated_at).toLocaleString()}
                </span>
                <button onClick={analyze} style={{
                  display:"flex", alignItems:"center", gap:5,
                  fontFamily:"var(--font-mono)", fontSize:8, color:C.muted,
                  background:"none", border:`1px solid ${C.border}`, borderRadius:4, padding:"4px 10px", cursor:"pointer",
                }}>
                  <RefreshCw size={10} /> REFRESH
                </button>
              </div>
            </div>

            {/* Tabs with animated underline */}
            <div style={{ display:"flex", gap:0, padding:"14px 52px 0", borderBottom:`1px solid ${C.border}`, position:"relative" }}>
              {(["overview","risk","guidance","financials","market"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  position:"relative",
                  fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.16em",
                  textTransform:"uppercase", padding:"9px 20px",
                  color: activeTab===tab ? C.accentHi : C.muted,
                  background:"none", border:"none", cursor:"pointer",
                  transition:"color 0.18s",
                }}>
                  {tab}
                  {activeTab===tab && (
                    <motion.div
                      layoutId="tab-underline"
                      style={{
                        position:"absolute", bottom:-1, left:0, right:0,
                        height:2, background:`linear-gradient(90deg, ${C.accentHi}, ${C.accent})`,
                        borderRadius:2,
                      }}
                      transition={{ type:"spring", stiffness:400, damping:32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div style={{ padding:"28px 52px" }}>

              {/* ── OVERVIEW TAB ── */}
              {activeTab==="overview" && (
                <motion.div
                  initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
                  style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:1020 }}
                >
                  {/* Sentiment */}
                  <div style={{ ...S.panel, padding:24, borderTop:`2px solid ${BAR[result.sentiment.label]||C.accentHi}` }}>
                    <p style={S.label}>FINBERT NLP SENTIMENT</p>
                    {(["positive","negative","neutral"] as const).map(k => (
                      <div key={k} style={{ marginBottom:16 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ fontFamily:"var(--font-sans)", fontSize:11, color:C.text2, textTransform:"capitalize" }}>{k}</span>
                          <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:BAR[k], fontWeight:700 }}>{(result.sentiment.score[k]*100).toFixed(1)}%</span>
                        </div>
                        <div style={{ height:3, background:"rgba(0,150,100,0.07)", borderRadius:2, overflow:"hidden" }}>
                          <motion.div
                            initial={{ width:0 }}
                            animate={{ width:`${result.sentiment.score[k]*100}%` }}
                            transition={{ duration:1.2, ease:"easeOut", delay:0.2 }}
                            style={{ height:"100%", borderRadius:2, background:BAR[k] }}
                          />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ ...S.label, marginBottom:0 }}>VERDICT</span>
                      <span style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:BAR[result.sentiment.label]||C.accentHi, letterSpacing:"0.12em" }}>
                        {result.sentiment.label.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Brief */}
                  <div style={{ ...S.panel, padding:24, borderTop:`2px solid ${C.accentHi}` }}>
                    <p style={S.label}>ANALYST BRIEF</p>
                    <p style={{ fontFamily:"var(--font-sans)", fontSize:12.5, lineHeight:1.95, color:"rgba(150,170,186,0.70)", margin:0 }}>{result.brief}</p>
                    <button style={{ marginTop:16, fontFamily:"var(--font-mono)", fontSize:8, letterSpacing:"0.16em", color:C.accentHi, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, opacity:0.65 }}>
                      <FileText size={10} /> EXPORT PDF REPORT
                    </button>
                  </div>

                  {/* Risk snapshot */}
                  <div style={{ ...S.panel, padding:24 }}>
                    <p style={S.label}>RISK SNAPSHOT</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                      {[
                        { l:"Added",    n:result.risk_delta.added.length,    c:C.neg },
                        { l:"Removed",  n:result.risk_delta.removed.length,  c:C.pos },
                        { l:"Modified", n:result.risk_delta.modified.length, c:C.neu },
                      ].map(d => (
                        <div key={d.l} style={{ background:"rgba(0,0,0,0.45)", border:`1px solid ${C.border}`, borderRadius:6, padding:"15px 8px", textAlign:"center" }}>
                          <motion.div
                            initial={{ scale:0.6, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ duration:0.5, delay:0.1 }}
                            style={{ fontFamily:"var(--font-display)", fontSize:32, fontWeight:800, color:d.c, lineHeight:1 }}
                          >{d.n}</motion.div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:8, marginTop:6, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted }}>{d.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Guidance summary */}
                  <div style={{ ...S.panel, padding:24 }}>
                    <p style={S.label}>GUIDANCE BREAKDOWN</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
                      {[
                        { l:"Optimistic", n:result.guidance.filter(g=>g.tag==="optimistic").length, c:C.pos },
                        { l:"Cautious",   n:result.guidance.filter(g=>g.tag==="cautious").length,   c:C.neg },
                        { l:"Neutral",    n:result.guidance.filter(g=>g.tag==="neutral").length,    c:C.neu },
                      ].map(d => (
                        <div key={d.l} style={{ background:"rgba(0,0,0,0.45)", border:`1px solid ${C.border}`, borderRadius:6, padding:"15px 8px", textAlign:"center" }}>
                          <motion.div
                            initial={{ scale:0.6, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ duration:0.5, delay:0.15 }}
                            style={{ fontFamily:"var(--font-display)", fontSize:32, fontWeight:800, color:d.c, lineHeight:1 }}
                          >{d.n}</motion.div>
                          <div style={{ fontFamily:"var(--font-mono)", fontSize:8, marginTop:6, textTransform:"uppercase", letterSpacing:"0.12em", color:C.muted }}>{d.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── RISK TAB ── */}
              {activeTab==="risk" && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ maxWidth:900 }}>
                  <div style={{ ...S.panel, padding:24, marginBottom:16, borderLeft:`3px solid ${C.neg}` }}>
                    <p style={S.label}>NEW RISK FACTORS — {result.risk_delta.added.length} ADDED</p>
                    {result.risk_delta.added.length===0
                      ? <p style={{ ...S.muted, fontSize:11 }}>No new risk factors vs prior quarter.</p>
                      : result.risk_delta.added.map((s,i) => (
                          <div key={i} style={{ display:"flex", gap:12, marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
                            <span style={{ color:C.neg, fontFamily:"var(--font-mono)", fontSize:13, flexShrink:0, marginTop:1, fontWeight:700 }}>+</span>
                            <p style={{ fontFamily:"var(--font-sans)", fontSize:12.5, lineHeight:1.7, color:"rgba(150,170,186,0.7)", margin:0 }}>{s}</p>
                          </div>
                        ))
                    }
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                    <div style={{ ...S.panel, padding:24, borderLeft:`3px solid ${C.pos}` }}>
                      <p style={S.label}>REMOVED — {result.risk_delta.removed.length}</p>
                      {result.risk_delta.removed.length===0
                        ? <p style={{ ...S.muted, fontSize:11 }}>None removed.</p>
                        : result.risk_delta.removed.slice(0,5).map((s,i) => (
                            <div key={i} style={{ display:"flex", gap:8, marginBottom:10 }}>
                              <span style={{ color:C.pos, fontFamily:"var(--font-mono)", fontSize:11, flexShrink:0, fontWeight:700 }}>−</span>
                              <p style={{ fontFamily:"var(--font-sans)", fontSize:11, lineHeight:1.65, color:C.muted, margin:0 }}>{s.slice(0,150)}{s.length>150?"…":""}</p>
                            </div>
                          ))
                      }
                    </div>
                    <div style={{ ...S.panel, padding:24, borderLeft:`3px solid ${C.neu}` }}>
                      <p style={S.label}>MODIFIED — {result.risk_delta.modified.length}</p>
                      {result.risk_delta.modified.length===0
                        ? <p style={{ ...S.muted, fontSize:11 }}>None modified.</p>
                        : result.risk_delta.modified.slice(0,3).map(([o,n],i) => (
                            <div key={i} style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.border}` }}>
                              <p style={{ fontFamily:"var(--font-sans)", fontSize:10, color:C.neg, marginBottom:5 }}>BEFORE: {o.slice(0,80)}…</p>
                              <p style={{ fontFamily:"var(--font-sans)", fontSize:10, color:C.pos, margin:0 }}>AFTER: {n.slice(0,80)}…</p>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── GUIDANCE TAB ── */}
              {activeTab==="guidance" && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ maxWidth:800 }}>
                  <div style={{ ...S.panel, padding:24 }}>
                    <p style={S.label}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
                    {result.guidance.length===0
                      ? <p style={{ ...S.muted, fontSize:11 }}>No forward guidance signals detected in MD&A.</p>
                      : (
                          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                            {result.guidance.map((g,i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07, duration:0.28 }}
                                style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"14px 0", borderBottom:`1px solid ${C.border}` }}
                              >
                                <span style={{ fontFamily:"var(--font-mono)", fontSize:7, padding:"3px 9px", borderRadius:3, flexShrink:0, letterSpacing:"0.14em", marginTop:2, ...TAG[g.tag] }}>
                                  {g.tag.toUpperCase()}
                                </span>
                                <p style={{ fontFamily:"var(--font-sans)", fontSize:13, lineHeight:1.7, color:"rgba(150,170,186,0.70)", margin:0 }}>{g.text}</p>
                              </motion.div>
                            ))}
                          </div>
                        )
                    }
                  </div>
                </motion.div>
              )}

              {/* ── FINANCIALS TAB ── */}
              {activeTab==="financials" && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ maxWidth:920 }}>
                  {!result.financials?.available
                    ? (
                      <div style={{ ...S.panel, padding:32, textAlign:"center" }}>
                        <p style={{ ...S.muted, fontSize:12 }}>Financial table data could not be extracted from this filing.</p>
                      </div>
                    )
                    : (
                      <>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
                          {[
                            { k:"Revenue",       v:result.financials.revenue,          c:C.accentHi },
                            { k:"Net Income",    v:result.financials.net_income,       c:C.pos },
                            { k:"Gross Profit",  v:result.financials.gross_profit,     c:C.pos },
                            { k:"Operating Inc.",v:result.financials.operating_income, c:C.accentHi },
                            { k:"EPS Diluted",   v:result.financials.eps_diluted ? `$${result.financials.eps_diluted}` : undefined, c:C.accentHi },
                            { k:"EPS Basic",     v:result.financials.eps_basic    ? `$${result.financials.eps_basic}`    : undefined, c:C.accentHi },
                          ].filter(m => m.v).map((m, i) => (
                            <motion.div
                              key={m.k}
                              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.06 }}
                              style={{ ...S.panel, padding:"20px 22px", borderTop:`2px solid ${m.c}` }}
                            >
                              <p style={{ ...S.label, marginBottom:10 }}>{m.k}</p>
                              <p style={{ fontFamily:"var(--font-display)", fontSize:24, color:m.c, fontWeight:700, margin:0 }}>{m.v}</p>
                            </motion.div>
                          ))}
                        </div>

                        {(result.financials.gross_margin || result.financials.operating_margin || result.financials.net_margin) && (
                          <div style={{ ...S.panel, padding:24 }}>
                            <p style={S.label}>MARGIN ANALYSIS</p>
                            {[
                              { l:"Gross Margin",     v:result.financials.gross_margin },
                              { l:"Operating Margin", v:result.financials.operating_margin },
                              { l:"Net Margin",       v:result.financials.net_margin },
                            ].filter(m => m.v).map(m => {
                              const pct = parseFloat(m.v!.replace("%",""));
                              const col = pct>30 ? C.pos : pct>15 ? C.accentHi : C.neu;
                              return (
                                <div key={m.l} style={{ marginBottom:18 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                                    <span style={{ fontFamily:"var(--font-sans)", fontSize:12, color:C.text2 }}>{m.l}</span>
                                    <span style={{ fontFamily:"var(--font-mono)", fontSize:13, color:col, fontWeight:700 }}>{m.v}</span>
                                  </div>
                                  <div style={{ height:4, background:"rgba(0,150,100,0.07)", borderRadius:2, overflow:"hidden" }}>
                                    <motion.div
                                      initial={{ width:0 }} animate={{ width:`${Math.min(pct,100)}%` }} transition={{ duration:1.2, ease:"easeOut", delay:0.2 }}
                                      style={{ height:"100%", borderRadius:2, background:col }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )
                  }
                </motion.div>
              )}

              {/* ── MARKET TAB ── */}
              {activeTab==="market" && (
                <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }} style={{ maxWidth:820 }}>
                  {!result.market?.price
                    ? <div style={{ ...S.panel, padding:24 }}><p style={{ ...S.muted, fontSize:12 }}>Live market data unavailable.</p></div>
                    : (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                        {[
                          { k:"PRICE",      v:`$${result.market.price?.toFixed(2)}`,      c:C.text,    border:C.accentHi },
                          { k:"P/E RATIO",  v:result.market.pe_ratio?.toFixed(1)??"—",    c:C.accentHi, border:C.accentHi },
                          { k:"MARKET CAP", v:fmtMarketCap(result.market.market_cap),      c:C.accentHi, border:C.accentHi },
                          { k:"52W HIGH",   v:`$${result.market["52w_high"]?.toFixed(2)}`, c:C.pos,      border:C.pos },
                          { k:"52W LOW",    v:`$${result.market["52w_low"]?.toFixed(2)}`,  c:C.neg,      border:C.neg },
                          { k:"TICKER",     v:result.market.ticker,                         c:C.text,     border:C.border },
                        ].map((m, i) => (
                          <motion.div
                            key={m.k}
                            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
                            style={{ ...S.panel, padding:"20px 22px", borderTop:`2px solid ${m.border}` }}
                          >
                            <p style={{ ...S.label, marginBottom:10 }}>{m.k}</p>
                            <p style={{ fontFamily:"var(--font-display)", fontSize:22, color:m.c, fontWeight:700, margin:0 }}>{m.v}</p>
                          </motion.div>
                        ))}
                      </div>
                    )
                  }
                </motion.div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ══ CHAT PANEL ══ */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity:0, x:20, scale:0.97 }}
            animate={{ opacity:1, x:0, scale:1 }}
            exit={{ opacity:0, x:20, scale:0.97 }}
            transition={{ duration:0.28 }}
            style={{
              position:"fixed", bottom:32, right:460, zIndex:55,
              width:310, height:430,
              background:"rgba(5,8,10,0.99)",
              border:`1px solid ${C.borderHi}`,
              borderRadius:10, overflow:"hidden",
              backdropFilter:"blur(32px)",
              boxShadow:"0 20px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,200,150,0.06)",
              display:"flex", flexDirection:"column",
            }}
          >
            {/* Chat header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:`1px solid ${C.border}`, background:"rgba(0,0,0,0.45)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Brain size={12} color={C.accentHi} />
                <span style={{ fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.20em", color:C.accentHi }}>FINSIGHT AI</span>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:7, color:C.muted, letterSpacing:"0.1em" }}>· GROQ LLAMA-3</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background:"none", border:"none", cursor:"pointer" }}>
                <X size={13} color={C.muted} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgs.map((m,i) => (
                <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                  <div style={{
                    maxWidth:"88%", borderRadius:7, padding:"9px 13px",
                    fontSize:12, lineHeight:1.65, fontFamily:"var(--font-sans)",
                    ...(m.role==="user"
                      ? { background:"rgba(0,200,150,0.10)", border:`1px solid rgba(0,200,150,0.20)`, color:C.text }
                      : { background:"rgba(0,0,0,0.55)", border:`1px solid ${C.border}`, color:"rgba(150,170,186,0.78)" }
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

            {/* Input */}
            <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8, background:"rgba(0,0,0,0.3)" }}>
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && sendChat()}
                placeholder="Ask about the filing…"
                style={{ flex:1, background:"rgba(0,0,0,0.6)", border:`1px solid ${C.border}`, borderRadius:6, padding:"9px 13px", fontFamily:"var(--font-sans)", fontSize:12, color:C.text, outline:"none" }}
              />
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} style={{
                background:"rgba(0,200,150,0.10)", border:`1px solid ${C.borderHi}`,
                borderRadius:6, padding:"0 13px", cursor:"pointer",
                opacity:chatLoading||!chatInput.trim()?0.3:1, display:"flex", alignItems:"center",
                transition:"opacity 0.14s",
              }}>
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
        {/* Glow beneath robot */}
        <div style={{ position:"absolute", top:"40%", left:"48%", transform:"translate(-50%,-50%)", width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,200,150,0.08) 0%, transparent 70%)", filter:"blur(40px)", pointerEvents:"none" }} />

        {/* Badge */}
        <motion.div
          initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.6 }}
          style={{
            position:"absolute", top:52, left:16, zIndex:1,
            background:"rgba(5,8,10,0.97)", border:`1px solid ${chatOpen ? C.borderHi : C.border}`,
            borderRadius:20, padding:"6px 14px",
            fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.14em", color:C.accentHi,
            display:"flex", alignItems:"center", gap:7, pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(0,0,0,0.55)",
          }}
        >
          <span style={{ width:5, height:5, borderRadius:"50%", background:C.accentHi, display:"inline-block", animation:"pulse 2.5s infinite" }} />
          {chatOpen ? "CHAT OPEN · GROQ AI" : "ANALYST READY · CLICK TO CHAT"}
        </motion.div>
        <SplineScene className="w-full h-full" />
      </div>

      {/* ══ CIRCULAR NAV ══ */}
      <div style={{ position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", zIndex:48 }}>
        {[
          { icon:Home,          label:"OVERVIEW",  id:"home",     a:270, r:90 },
          { icon:BarChart2,     label:"ANALYSIS",  id:"analysis", a:234, r:90 },
          { icon:Shield,        label:"RISK",      id:"risk",     a:306, r:90 },
          { icon:Database,      label:"RESEARCH",  id:"research", a:198, r:90 },
          { icon:MessageCircle, label:"CHAT",      id:"chat",     a:342, r:90 },
        ].map((item, i) => {
          const rad = (item.a * Math.PI) / 180;
          const x   = Math.cos(rad) * item.r;
          const y   = Math.sin(rad) * item.r;
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
                <Icon size={14} color="rgba(0,200,150,0.42)" />
              </div>
            </div>
          );
        })}
        <div onClick={() => setNavOpen(v => !v)} style={{
          position:"relative", zIndex:50, width:50, height:50, borderRadius:"50%",
          background: navOpen?"rgba(0,200,150,0.12)":"rgba(5,8,10,0.96)",
          border:`1px solid ${navOpen ? C.borderHi : C.border}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", backdropFilter:"blur(20px)",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)", transition:"all 0.26s",
        }}>
          {navOpen ? <X size={16} color={C.accentHi} /> : <Menu size={16} color="rgba(0,200,150,0.48)" />}
        </div>
      </div>

    </div>
  );
}
