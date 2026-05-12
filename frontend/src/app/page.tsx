"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BarChart2, Shield, Database, MessageCircle,
  Search, X, Menu, Zap, FileText, Send, Brain, ChevronRight,
} from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import { sendChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/types/brief";

/* ─── types ─────────────────────────────────────────────── */
interface SS { positive: number; negative: number; neutral: number }
interface AR {
  ticker: string; quarter: string;
  sentiment: { label: string; score: SS };
  guidance: { text: string; tag: string }[];
  risk_delta: { added: string[]; removed: string[]; modified: [string, string][] };
  brief: string;
}

/* ─── nav ────────────────────────────────────────────────── */
const NAV = [
  { icon: Home,          label: "OVERVIEW", id: "home",     a: 270, r: 92 },
  { icon: BarChart2,     label: "ANALYSIS", id: "analysis", a: 234, r: 92 },
  { icon: Shield,        label: "RISK",     id: "risk",     a: 306, r: 92 },
  { icon: Database,      label: "RESEARCH", id: "research", a: 198, r: 92 },
  { icon: MessageCircle, label: "CHAT",     id: "chat",     a: 342, r: 92 },
];
function cp(a: number, r: number) {
  const rad = (a * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

/* ─── colour system (corporate finance) ─────────────────── */
// Background:  #05080A  — near-black, cool charcoal
// Surface:     #0B0F13  — dark panels
// Accent:      #00997A  — muted teal-green (professional, not neon)
// Accent hi:   #00BF92  — used sparingly for key numbers
// Positive:    #00CC7A  — data positive
// Negative:    #E04055  — data negative
// Neutral:     #D48F00  — neutral / amber
// Border:      rgba(0,140,95,0.12)
// Text:        #C4D4DC  — cool white
// Muted text:  rgba(170,195,210,0.38)

const C = {
  bg:      "#05080A",
  surface: "rgba(11,15,19,0.96)",
  accent:  "#00997A",
  accentHi:"#00BF92",
  pos:     "#00CC7A",
  neg:     "#E04055",
  neu:     "#D48F00",
  border:  "rgba(0,140,95,0.12)",
  borderHi:"rgba(0,140,95,0.28)",
  text:    "#C4D4DC",
  muted:   "rgba(170,195,210,0.36)",
};

const BAR: Record<string, string> = {
  positive: C.pos, negative: C.neg, neutral: C.neu,
};
const TAG: Record<string, React.CSSProperties> = {
  optimistic: { background: "rgba(0,204,122,0.08)", border: `1px solid rgba(0,204,122,0.22)`, color: C.pos },
  cautious:   { background: "rgba(224,64,85,0.08)",  border: `1px solid rgba(224,64,85,0.22)`,  color: C.neg },
  neutral:    { background: "rgba(212,143,0,0.08)",  border: `1px solid rgba(212,143,0,0.22)`,  color: C.neu },
};

/* ─── reusable styles ────────────────────────────────────── */
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
    color: "rgba(0,153,122,0.5)",
    textTransform: "uppercase" as const,
    marginBottom: 14,
  } as React.CSSProperties,
  text: {
    fontFamily: "var(--font-sans)",
    color: C.muted,
  } as React.CSSProperties,
};

/* ══════════════════════════════════════════════════════════ */
export default function Page() {

  const [ticker,  setTicker]  = useState("");
  const [quarter, setQuarter] = useState("Q1-2024");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AR | null>(null);
  const [err,     setErr]     = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [active,  setActive]  = useState("home");
  const [chatOpen,    setChatOpen]    = useState(false);
  const [msgs,        setMsgs]        = useState<ChatMessage[]>([
    { role: "assistant", content: "Analyst ready. Ask me about any SEC filing, risk factor, or equity data." },
  ]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, chatOpen]);

  async function analyze() {
    if (!ticker.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      const r = await fetch("http://localhost:5000/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), quarter }),
      });
      if (!r.ok) throw new Error(`Server ${r.status}`);
      setResult(await r.json()); setActive("analysis");
    } catch (e) { setErr(e instanceof Error ? e.message : "Connection failed. Start Flask first."); }
    finally { setLoading(false); }
  }

  async function sendChat() {
    const q = chatInput.trim(); if (!q || chatLoading) return;
    setChatInput(""); setMsgs(p => [...p, { role: "user", content: q }]);
    setChatLoading(true);
    try {
      const res = await sendChatMessage(q, ticker);
      setMsgs(p => [...p, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Flask not reachable on port 5000." }]);
    } finally { setChatLoading(false); }
  }

  /* ════════════════════ RENDER ══════════════════════════ */
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: C.bg, overflowX: "hidden" }}>

      {/* ── Subtle grid texture overlay ── */}
      <div className="bg-grid" style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.6,
      }} />

      {/* ── Very faint corner vignettes (not "party orbs") ── */}
      {/* Top-left — extremely subtle */}
      <div style={{
        position: "fixed", top: -300, left: -300, zIndex: 0, pointerEvents: "none",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,140,95,0.07) 0%, transparent 65%)",
        filter: "blur(60px)",
      }} />
      {/* Bottom-right corner accent — behind robot */}
      <div style={{
        position: "fixed", bottom: -200, right: -200, zIndex: 0, pointerEvents: "none",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,100,70,0.06) 0%, transparent 65%)",
        filter: "blur(55px)",
      }} />

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 44px",
        background: "rgba(5,8,10,0.92)", backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(0,153,122,0.08)", border: `1px solid rgba(0,153,122,0.22)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={12} color={C.accentHi} />
          </div>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: 19, letterSpacing: "0.22em",
            color: C.text,
          }}>FINSIGHT</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em",
            color: C.muted, paddingLeft: 6, borderLeft: `1px solid ${C.border}`, marginLeft: 4,
          }}>EQUITY INTELLIGENCE</span>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", gap: 40, alignItems: "center" }}>
          {["Platform", "Research", "Risk", "Data"].map(n => (
            <button key={n} style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em",
              textTransform: "uppercase", color: C.muted,
              background: "none", border: "none", cursor: "pointer", transition: "color 0.18s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.text)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
            >{n}</button>
          ))}
        </nav>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.14em",
            color: "rgba(0,153,122,0.5)",
            padding: "4px 10px",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accentHi, display: "inline-block", animation: "pulse 2.5s infinite" }} />
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", padding: "96px 52px 100px",
        display: "flex", alignItems: "center",
      }}>
        <div style={{ maxWidth: 560, width: "100%", display: "flex", flexDirection: "column", gap: 26 }}>

          {/* Eyebrow tag */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 12px",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            width: "fit-content",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.accentHi, display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.28em", color: "rgba(0,153,122,0.55)", textTransform: "uppercase" }}>
              SEC EDGAR · FINBERT NLP · FAISS RAG
            </span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(60px, 7.5vw, 104px)",
            lineHeight: 0.9, letterSpacing: "0.02em",
            color: C.text,
          }}>
            AUTOMATED<br />
            <span style={{ color: C.accentHi }}>EQUITY</span><br />
            RESEARCH
          </h1>

          {/* Divider */}
          <div style={{ width: 48, height: 1, background: `linear-gradient(90deg, ${C.accentHi}, transparent)` }} />

          {/* Sub */}
          <p style={{ ...S.text, fontSize: 13, lineHeight: 1.85, maxWidth: 420, color: "rgba(170,195,210,0.5)" }}>
            Ingest 10-K / 10-Q filings from SEC EDGAR, score MD&amp;A sentiment
            with FinBERT, detect Q-over-Q risk changes, and surface source-cited
            analyst briefs — fully local, zero paid APIs.
          </p>

          {/* ── Search form ── */}
          <div style={{ ...S.panel, padding: 24 }}>

            {/* Field row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...S.label, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                  Stock Ticker
                  <span title="Stock ticker symbol — e.g. AAPL, MSFT, NVDA, JPM" style={{ cursor: "help", color: C.border, fontSize: 11 }}>ⓘ</span>
                </label>
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder="AAPL · MSFT · NVDA · JPM"
                  style={{
                    width: "100%", background: "rgba(0,0,0,0.6)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: "10px 14px",
                    fontFamily: "var(--font-mono)", fontSize: 13,
                    color: C.text, outline: "none", letterSpacing: "0.06em",
                    transition: "border-color 0.18s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = C.borderHi)}
                  onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                />
              </div>

              <div>
                <label style={{ ...S.label, marginBottom: 7 }}>Quarter</label>
                <select
                  value={quarter} onChange={e => setQuarter(e.target.value)}
                  style={{
                    background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 6, padding: "10px 11px",
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: C.text, outline: "none",
                  }}
                >
                  {["Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025","Q3-2025","Q4-2025"].map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={analyze} disabled={loading || !ticker.trim()}
              style={{
                width: "100%",
                background: loading || !ticker.trim()
                  ? "rgba(0,153,122,0.04)"
                  : "rgba(0,153,122,0.10)",
                border: `1px solid ${loading || !ticker.trim() ? C.border : C.borderHi}`,
                borderRadius: 6, padding: "12px 0",
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
                color: loading || !ticker.trim() ? C.muted : C.accentHi,
                cursor: loading || !ticker.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.18s",
              }}
            >
              {loading
                ? <><span className="loader" /> PROCESSING…</>
                : <><Search size={12} /> RUN ANALYSIS</>
              }
            </button>

            {err && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: C.neg, marginTop: 9, letterSpacing: "0.08em" }}>
                ✗ {err}
              </p>
            )}

            {/* Quick fill */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13 }}>
              <ChevronRight size={9} color={C.muted} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: C.muted, letterSpacing: "0.16em", marginRight: 2 }}>QUICK SELECT</span>
              {["AAPL","MSFT","NVDA","JPM","TSLA"].map(t => (
                <button key={t} onClick={() => setTicker(t)} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
                  border: `1px solid ${C.border}`, borderRadius: 3,
                  background: "transparent", color: C.muted, cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.borderHi; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Quick stats strip */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{ display: "flex", gap: 8 }}
            >
              {[
                { k: "SENTIMENT", v: result.sentiment.label.toUpperCase(), c: BAR[result.sentiment.label] ?? C.accentHi },
                { k: "GUIDANCE",  v: `${result.guidance.length} SIGNALS`,  c: C.neu },
                { k: "RISK Δ",    v: `+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`, c: C.pos },
              ].map(m => (
                <div key={m.k} style={{ ...S.panel, flex: 1, padding: "12px 14px" }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>{m.k}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: m.c, fontWeight: 700, letterSpacing: "0.04em" }}>{m.v}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ══ RESULTS ═══════════════════════════════════════════ */}
      {result && (
        <section style={{ position: "relative", zIndex: 1, padding: "0 52px 200px", maxWidth: 1180, margin: "0 auto" }}>

          {/* Section header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 20, paddingBottom: 16,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accentHi, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", color: "rgba(0,153,122,0.5)" }}>
                ANALYSIS REPORT — {result.ticker} · {result.quarter}
              </span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: C.muted, letterSpacing: "0.12em" }}>
              GENERATED {new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            {/* Sentiment */}
            <div style={{ ...S.panel, padding: 22 }}>
              <p style={S.label}>FINBERT NLP SENTIMENT</p>
              {(["positive","negative","neutral"] as const).map(k => (
                <div key={k} style={{ marginBottom: 15 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ ...S.text, fontSize: 10, textTransform: "capitalize", letterSpacing: "0.06em" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: BAR[k] }}>{(result.sentiment.score[k] * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 2, background: "rgba(0,140,95,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${result.sentiment.score[k] * 100}%`,
                      background: BAR[k], transition: "width 1.4s ease",
                    }} />
                  </div>
                </div>
              ))}
              <div style={{
                marginTop: 16, paddingTop: 13,
                borderTop: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ ...S.label, marginBottom: 0 }}>VERDICT</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
                  color: BAR[result.sentiment.label] ?? C.accentHi,
                  letterSpacing: "0.1em",
                }}>{result.sentiment.label.toUpperCase()}</span>
              </div>
            </div>

            {/* Risk delta */}
            <div style={{ ...S.panel, padding: 22 }}>
              <p style={S.label}>RISK FACTOR Δ — Q-OVER-Q</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[
                  { l: "Added",    n: result.risk_delta.added.length,    c: C.pos },
                  { l: "Removed",  n: result.risk_delta.removed.length,  c: C.neg },
                  { l: "Modified", n: result.risk_delta.modified.length, c: C.neu },
                ].map(d => (
                  <div key={d.l} style={{
                    background: "rgba(0,0,0,0.4)", borderRadius: 6,
                    padding: "14px 8px", textAlign: "center",
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: d.c }}>{d.n}</div>
                    <div style={{ ...S.text, fontSize: 8, marginTop: 5, letterSpacing: "0.12em", textTransform: "uppercase" }}>{d.l}</div>
                  </div>
                ))}
              </div>
              {result.risk_delta.added.slice(0, 2).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                  <span style={{ color: C.pos, fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>+</span>
                  <p style={{ ...S.text, fontSize: 11, lineHeight: 1.6 }}>{s.slice(0,120)}{s.length > 120 ? "…" : ""}</p>
                </div>
              ))}
            </div>

            {/* Guidance */}
            <div style={{ ...S.panel, padding: 22 }}>
              <p style={S.label}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
              {result.guidance.length === 0
                ? <p style={{ ...S.text, fontSize: 11 }}>No forward guidance signals detected.</p>
                : <div style={{ maxHeight: 175, overflowY: "auto", display: "flex", flexDirection: "column", gap: 11 }}>
                    {result.guidance.slice(0, 6).map((g, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 7, padding: "3px 7px",
                          borderRadius: 3, flexShrink: 0, letterSpacing: "0.12em",
                          ...TAG[g.tag],
                        }}>{g.tag.toUpperCase()}</span>
                        <p style={{ ...S.text, fontSize: 11, lineHeight: 1.6 }}>{g.text.slice(0,100)}{g.text.length > 100 ? "…" : ""}</p>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Analyst brief */}
            <div style={{ ...S.panel, padding: 22 }}>
              <p style={S.label}>ANALYST BRIEF</p>
              <p style={{ ...S.text, fontSize: 12, lineHeight: 1.9 }}>{result.brief}</p>
              <button style={{
                marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 8,
                letterSpacing: "0.16em", color: C.accentHi,
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, opacity: 0.7,
              }}>
                <FileText size={10} /> EXPORT PDF REPORT
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══ CHAT PANEL ════════════════════════════════════════ */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            style={{
              position: "fixed", bottom: 490, right: 20, zIndex: 55,
              width: 320, height: 440,
              background: "rgba(5,8,10,0.98)",
              border: `1px solid ${C.borderHi}`,
              borderRadius: 10, overflow: "hidden",
              backdropFilter: "blur(28px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,153,122,0.05)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Chat header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "13px 16px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(0,0,0,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={12} color={C.accentHi} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: C.accentHi }}>FINSIGHT AI</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: C.muted, letterSpacing: "0.12em" }}>· RAG ENABLED</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <X size={13} color={C.muted} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "88%", borderRadius: 7, padding: "9px 13px",
                    fontSize: 12, lineHeight: 1.6, fontFamily: "var(--font-sans)",
                    ...(m.role === "user"
                      ? { background: "rgba(0,153,122,0.12)", border: `1px solid rgba(0,153,122,0.22)`, color: C.text }
                      : { background: "rgba(0,0,0,0.55)", border: `1px solid ${C.border}`, color: "rgba(170,195,210,0.72)" }
                    ),
                  }}>
                    {m.content}
                    {m.sources && m.sources.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
                        {m.sources.slice(0,2).map((s,j) => (
                          <p key={j} style={{ fontSize: 10, color: "rgba(0,153,122,0.4)", fontStyle: "italic", marginTop: 3 }}>"{s.text.slice(0,72)}…"</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "11px 15px" }}>
                    <span className="loader" style={{ width: 11, height: 11, borderWidth: 2 }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about the filing…"
                style={{
                  flex: 1, background: "rgba(0,0,0,0.65)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6, padding: "9px 13px",
                  fontFamily: "var(--font-sans)", fontSize: 12,
                  color: C.text, outline: "none",
                }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  background: "rgba(0,153,122,0.12)", border: `1px solid ${C.borderHi}`,
                  borderRadius: 6, padding: "0 13px", cursor: "pointer",
                  opacity: chatLoading || !chatInput.trim() ? 0.3 : 1,
                  display: "flex", alignItems: "center",
                }}
              >
                <Send size={13} color={C.accentHi} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ROBOT — fixed bottom-right, IS the chat trigger ══ */}
      <div
        onClick={() => setChatOpen(v => !v)}
        title={chatOpen ? "Close analyst" : "Open FinSight AI"}
        style={{
          position: "fixed", bottom: 0, right: 0, zIndex: 50,
          width: 420, height: 460, cursor: "pointer",
        }}
      >
        {/* Very subtle glow directly behind robot head */}
        <div style={{
          position: "absolute", top: "45%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 220, height: 220, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,153,122,0.10) 0%, transparent 70%)",
          filter: "blur(30px)", pointerEvents: "none",
        }} />

        {/* Status badge */}
        {!chatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            style={{
              position: "absolute", top: 36, left: 18, zIndex: 1,
              background: "rgba(5,8,10,0.96)",
              border: `1px solid ${C.borderHi}`,
              borderRadius: 20, padding: "6px 14px",
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
              color: C.accentHi,
              display: "flex", alignItems: "center", gap: 7,
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accentHi, display: "inline-block", animation: "pulse 2.5s infinite" }} />
            ANALYST READY
          </motion.div>
        )}

        {/* Robot Spline scene */}
        <SplineScene className="w-full h-full" />
      </div>

      {/* ══ CIRCULAR NAV — bottom center ═════════════════════ */}
      <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 48 }}>

        {NAV.map((item, i) => {
          const { x, y } = cp(item.a, item.r);
          const Icon = item.icon;
          const isAct = active === item.id;
          return (
            <div
              key={item.id}
              onClick={() => { setActive(item.id); setNavOpen(false); }}
              style={{
                position: "absolute", left: "50%", bottom: "50%",
                transform: navOpen
                  ? `translate(calc(-50% + ${x}px), calc(50% + ${y}px))`
                  : "translate(-50%, 50%)",
                opacity: navOpen ? 1 : 0,
                pointerEvents: navOpen ? "auto" : "none",
                transition: `transform 0.44s cubic-bezier(0.34,1.56,0.64,1) ${i*40}ms, opacity 0.22s ease ${i*28}ms`,
                zIndex: 49,
              }}
            >
              <div style={{
                position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(5,8,10,0.98)", border: `1px solid ${C.border}`,
                borderRadius: 4, padding: "3px 9px",
                fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: "0.14em",
                color: C.accentHi, whiteSpace: "nowrap", pointerEvents: "none",
                opacity: navOpen ? 1 : 0,
                transition: `opacity 0.18s ease ${i*40+120}ms`,
              }}>{item.label}</div>

              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: isAct ? "rgba(0,153,122,0.16)" : "rgba(5,8,10,0.96)",
                border: `1px solid ${isAct ? C.borderHi : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", backdropFilter: "blur(16px)",
                boxShadow: isAct ? `0 0 16px rgba(0,153,122,0.15)` : "none",
                transition: "all 0.2s",
              }}>
                <Icon size={14} color={isAct ? C.accentHi : "rgba(0,153,122,0.4)"} />
              </div>
            </div>
          );
        })}

        {/* Central toggle */}
        <div
          onClick={() => setNavOpen(v => !v)}
          style={{
            position: "relative", zIndex: 50,
            width: 50, height: 50, borderRadius: "50%",
            background: navOpen ? "rgba(0,153,122,0.14)" : "rgba(5,8,10,0.96)",
            border: `1px solid ${navOpen ? C.borderHi : C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(20px)",
            boxShadow: navOpen ? `0 0 24px rgba(0,153,122,0.12)` : "0 4px 20px rgba(0,0,0,0.5)",
            transition: "all 0.26s ease",
          }}
        >
          {navOpen
            ? <X size={16} color={C.accentHi} />
            : <Menu size={16} color="rgba(0,153,122,0.5)" />
          }
        </div>
      </div>

    </div>
  );
}
