"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BarChart2, Shield, Database, MessageCircle,
  Search, X, Menu, Zap, FileText, Send, Brain,
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

/* ─── colour helpers ─────────────────────────────────────── */
const BAR: Record<string, string> = { positive: "#00FF8A", negative: "#FF3D64", neutral: "#FFA520" };
const TAG: Record<string, React.CSSProperties> = {
  optimistic: { background: "rgba(0,255,138,0.09)", border: "1px solid rgba(0,255,138,0.26)", color: "#00FF8A" },
  cautious:   { background: "rgba(255,61,100,0.09)", border: "1px solid rgba(255,61,100,0.26)", color: "#FF3D64" },
  neutral:    { background: "rgba(255,165,32,0.09)", border: "1px solid rgba(255,165,32,0.26)", color: "#FFA520" },
};

/* ─── reusable style objects ─────────────────────────────── */
const S = {
  panel: {
    background: "rgba(0,14,6,0.92)",
    border: "1px solid rgba(0,200,100,0.13)",
    borderRadius: 10,
    backdropFilter: "blur(18px)",
  } as React.CSSProperties,
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 9, letterSpacing: "0.22em",
    color: "rgba(0,200,100,0.46)",
    textTransform: "uppercase" as const,
    marginBottom: 14,
  } as React.CSSProperties,
  text: { fontFamily: "var(--font-sans)", color: "rgba(170,210,180,0.55)" } as React.CSSProperties,
};

/* ══════════════════════════════════════════════════════════ */
export default function Page() {

  /* analysis state */
  const [ticker,  setTicker]  = useState("");
  const [quarter, setQuarter] = useState("Q1-2024");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AR | null>(null);
  const [err,     setErr]     = useState("");

  /* nav state */
  const [navOpen, setNavOpen] = useState(false);
  const [active,  setActive]  = useState("home");

  /* chat state */
  const [chatOpen,    setChatOpen]    = useState(false);
  const [msgs,        setMsgs]        = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey — ask me anything about the filing, market data, or equity research." },
  ]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, chatOpen]);

  /* ── analyze ── */
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

  /* ── send chat ── */
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

  /* ════════════════════════ RENDER ══════════════════════ */
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#030A05", overflowX: "hidden" }}>

      {/* ══ CIRCLE 1 — top-left, vivid large orb ══ */}
      <div style={{
        position: "fixed", top: -180, left: -180, zIndex: 0, pointerEvents: "none",
        width: 660, height: 660, borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,220,110,0.28) 0%, rgba(0,180,90,0.10) 42%, transparent 68%)",
        filter: "blur(36px)",
      }} />

      {/* ══ CIRCLE 2 — bottom-right, behind robot ══ */}
      <div style={{
        position: "fixed", bottom: -140, right: -140, zIndex: 0, pointerEvents: "none",
        width: 540, height: 540, borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,168,96,0.24) 0%, rgba(0,110,60,0.08) 44%, transparent 68%)",
        filter: "blur(30px)",
      }} />

      {/* ══ HEADER ══════════════════════════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: "rgba(3,10,5,0.88)", backdropFilter: "blur(22px)",
        borderBottom: "1px solid rgba(0,200,100,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 5,
            background: "rgba(0,200,100,0.09)", border: "1px solid rgba(0,200,100,0.24)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={11} color="#00D47A" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.2em", color: "#00D47A" }}>
            FINSIGHT
          </span>
        </div>

        <nav style={{ display: "flex", gap: 36 }}>
          {["Overview", "Research", "Risk"].map(n => (
            <button key={n} style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: "rgba(170,210,180,0.32)",
              background: "none", border: "none", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00D47A")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(170,210,180,0.32)")}
            >{n}</button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "rgba(0,212,122,0.48)" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00D47A", display: "inline-block", animation: "pulse 2s infinite" }} />
          SYSTEM ONLINE
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════ */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh", padding: "86px 52px 80px",
        display: "flex", alignItems: "center",
      }}>
        <div style={{ maxWidth: 580, width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* eyebrow */}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.38em", color: "rgba(0,200,100,0.52)", textTransform: "uppercase" }}>
            SEC EDGAR · FINBERT NLP · FAISS RAG · ZERO COST
          </p>

          {/* main heading */}
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(70px, 8.5vw, 112px)",
            lineHeight: 0.88, color: "#BDD4C3", letterSpacing: "0.02em",
          }}>
            AUTOMATED<br />
            <span style={{ color: "#00D47A" }}>EQUITY</span><br />
            RESEARCH
          </h1>

          {/* subtext */}
          <p style={{ ...S.text, fontSize: 13, lineHeight: 1.8, maxWidth: 400 }}>
            Ingest 10-K/10-Q filings from SEC EDGAR, score MD&amp;A sentiment
            with FinBERT, detect Q-over-Q risk changes, and get source-cited
            analyst briefs — fully local, no paid APIs.
          </p>

          {/* ── search form ── */}
          <div style={{ ...S.panel, padding: 22 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>

              {/* ticker */}
              <div style={{ flex: 1 }}>
                <label style={{ ...S.label, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  Stock Ticker
                  <span title="A stock ticker is the short symbol for a publicly traded company on a stock exchange. Examples: AAPL = Apple Inc., MSFT = Microsoft, NVDA = NVIDIA, AMZN = Amazon, TSLA = Tesla, JPM = JPMorgan Chase." style={{ cursor: "help", color: "rgba(0,200,100,0.28)", fontSize: 11 }}>ⓘ</span>
                </label>
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder="e.g. AAPL  ·  MSFT  ·  NVDA"
                  style={{
                    width: "100%", background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(0,200,100,0.16)",
                    borderRadius: 7, padding: "9px 13px",
                    fontFamily: "var(--font-mono)", fontSize: 13,
                    color: "#BDD4C3", outline: "none", letterSpacing: "0.05em",
                  }}
                />
              </div>

              {/* quarter */}
              <div>
                <label style={{ ...S.label, marginBottom: 6 }}>Quarter</label>
                <select
                  value={quarter} onChange={e => setQuarter(e.target.value)}
                  style={{
                    background: "#030A05", border: "1px solid rgba(0,200,100,0.16)",
                    borderRadius: 7, padding: "9px 10px",
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: "#BDD4C3", outline: "none",
                  }}
                >
                  {["Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025","Q3-2025","Q4-2025"].map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={analyze} disabled={loading || !ticker.trim()}
              style={{
                width: "100%",
                background: loading || !ticker.trim() ? "rgba(0,200,100,0.05)" : "rgba(0,200,100,0.11)",
                border: "1px solid rgba(0,200,100,0.24)",
                borderRadius: 7, padding: "11px 0",
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em",
                color: "#00D47A", cursor: loading || !ticker.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.18s",
              }}
            >
              {loading ? <><span className="loader" /> ANALYZING…</> : <><Search size={12} /> RUN ANALYSIS</>}
            </button>

            {err && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#FF3D64", marginTop: 8 }}>✗ {err}</p>}

            {/* quick fill */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(0,200,100,0.3)", letterSpacing: "0.2em" }}>TRY →</span>
              {["AAPL","MSFT","NVDA","AMZN","TSLA"].map(t => (
                <button key={t} onClick={() => setTicker(t)} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 8px",
                  border: "1px solid rgba(0,200,100,0.15)", borderRadius: 4,
                  background: "transparent", color: "rgba(0,200,100,0.48)", cursor: "pointer",
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* quick stats strip */}
          {result && (
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { k: "SENTIMENT", v: result.sentiment.label.toUpperCase(), c: BAR[result.sentiment.label] ?? "#00D47A" },
                { k: "GUIDANCE",  v: `${result.guidance.length} SIGNALS`,  c: "#FFA520" },
                { k: "RISK Δ",    v: `+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`, c: "#00FF8A" },
              ].map(m => (
                <div key={m.k} style={{ ...S.panel, flex: 1, padding: "11px 13px" }}>
                  <div style={{ ...S.label, marginBottom: 5 }}>{m.k}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: m.c, fontWeight: 700 }}>{m.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ RESULTS ══════════════════════════════════ */}
      {result && (
        <section style={{ position: "relative", zIndex: 1, padding: "0 52px 180px", maxWidth: 1200, margin: "0 auto" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid rgba(0,200,100,0.08)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D47A", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em", color: "rgba(0,200,100,0.5)" }}>
              ANALYSIS — {result.ticker} · {result.quarter}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* sentiment */}
            <div style={{ ...S.panel, padding: 20 }}>
              <p style={S.label}>FINBERT SENTIMENT</p>
              {(["positive","negative","neutral"] as const).map(k => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ ...S.text, fontSize: 11, textTransform: "capitalize" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: BAR[k] }}>{(result.sentiment.score[k] * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(0,200,100,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${result.sentiment.score[k] * 100}%`, background: BAR[k], transition: "width 1.2s ease" }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,200,100,0.08)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ ...S.label, marginBottom: 0 }}>VERDICT</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: BAR[result.sentiment.label] ?? "#00D47A", letterSpacing: "0.08em" }}>{result.sentiment.label.toUpperCase()}</span>
              </div>
            </div>

            {/* risk delta */}
            <div style={{ ...S.panel, padding: 20 }}>
              <p style={S.label}>RISK FACTOR Δ — Q-OVER-Q</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { l: "Added",    n: result.risk_delta.added.length,    c: "#00FF8A" },
                  { l: "Removed",  n: result.risk_delta.removed.length,  c: "#FF3D64" },
                  { l: "Modified", n: result.risk_delta.modified.length, c: "#FFA520" },
                ].map(d => (
                  <div key={d.l} style={{ background: "rgba(0,0,0,0.32)", borderRadius: 8, padding: "13px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: d.c }}>{d.n}</div>
                    <div style={{ ...S.text, fontSize: 9, marginTop: 4 }}>{d.l}</div>
                  </div>
                ))}
              </div>
              {result.risk_delta.added.slice(0, 2).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#00FF8A", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>+</span>
                  <p style={{ ...S.text, fontSize: 11, lineHeight: 1.55 }}>{s.slice(0,112)}{s.length > 112 ? "…" : ""}</p>
                </div>
              ))}
            </div>

            {/* guidance */}
            <div style={{ ...S.panel, padding: 20 }}>
              <p style={S.label}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
              {result.guidance.length === 0
                ? <p style={{ ...S.text, fontSize: 10 }}>No signals detected.</p>
                : <div style={{ maxHeight: 170, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.guidance.slice(0, 6).map((g, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, padding: "2px 7px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.1em", ...TAG[g.tag] }}>{g.tag.toUpperCase()}</span>
                        <p style={{ ...S.text, fontSize: 11, lineHeight: 1.55 }}>{g.text.slice(0, 95)}{g.text.length > 95 ? "…" : ""}</p>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* brief */}
            <div style={{ ...S.panel, padding: 20 }}>
              <p style={S.label}>ANALYST BRIEF</p>
              <p style={{ ...S.text, fontSize: 12, lineHeight: 1.85 }}>{result.brief}</p>
              <button style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "#00D47A", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={10} /> EXPORT PDF
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══ CHAT PANEL — above robot ══════════════════ */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed", bottom: 390, right: 16, zIndex: 55,
              width: 310, height: 420,
              background: "rgba(0,12,5,0.97)",
              border: "1px solid rgba(0,200,100,0.2)",
              borderRadius: 12, overflow: "hidden",
              backdropFilter: "blur(24px)",
              boxShadow: "0 0 50px rgba(0,200,100,0.07)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(0,200,100,0.1)", background: "rgba(0,18,8,0.8)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={12} color="#00D47A" />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "#00D47A" }}>FINSIGHT AI</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={13} color="rgba(0,200,100,0.45)" />
              </button>
            </div>

            {/* messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "86%", borderRadius: 8, padding: "8px 12px",
                    fontSize: 12, lineHeight: 1.55, fontFamily: "var(--font-sans)",
                    ...(m.role === "user"
                      ? { background: "rgba(0,200,100,0.14)", border: "1px solid rgba(0,200,100,0.22)", color: "#BDD4C3" }
                      : { background: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,200,100,0.09)", color: "rgba(170,210,180,0.72)" }
                    ),
                  }}>
                    {m.content}
                    {m.sources && m.sources.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,200,100,0.09)" }}>
                        {m.sources.slice(0,2).map((s,j) => (
                          <p key={j} style={{ fontSize: 10, color: "rgba(0,200,100,0.38)", fontStyle: "italic", marginTop: 2 }}>"{s.text.slice(0,70)}…"</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,200,100,0.09)", borderRadius: 8, padding: "10px 14px" }}>
                    <span className="loader" style={{ width: 11, height: 11, borderWidth: 2 }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* input */}
            <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(0,200,100,0.09)", display: "flex", gap: 8 }}>
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Ask about the filing…"
                style={{ flex: 1, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(0,200,100,0.14)", borderRadius: 7, padding: "8px 12px", fontFamily: "var(--font-sans)", fontSize: 12, color: "#BDD4C3", outline: "none" }}
              />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ background: "rgba(0,200,100,0.13)", border: "1px solid rgba(0,200,100,0.28)", borderRadius: 7, padding: "0 12px", cursor: "pointer", opacity: chatLoading || !chatInput.trim() ? 0.38 : 1, display: "flex", alignItems: "center" }}>
                <Send size={13} color="#00D47A" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ROBOT — fixed bottom-right, IS the chat button ══ */}
      <div
        onClick={() => setChatOpen(v => !v)}
        title={chatOpen ? "Close chat" : "Ask FinSight AI"}
        style={{
          position: "fixed", bottom: 0, right: 0, zIndex: 50,
          width: 340, height: 370, cursor: "pointer",
        }}
      >
        {/* glow circle behind robot */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -46%)",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,200,100,0.16) 0%, transparent 70%)",
          filter: "blur(22px)", pointerEvents: "none",
        }} />

        {/* "ASK ME" badge — shown when chat is closed */}
        {!chatOpen && (
          <div style={{
            position: "absolute", top: 20, left: 12, zIndex: 1,
            background: "rgba(0,12,5,0.94)", border: "1px solid rgba(0,200,100,0.26)",
            borderRadius: 20, padding: "5px 12px",
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em",
            color: "#00D47A", display: "flex", alignItems: "center", gap: 6,
            pointerEvents: "none",
          }}>
            <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#00D47A", display: "inline-block" }} />
            ASK ME
          </div>
        )}

        {/* robot */}
        <SplineScene className="w-full h-full" />
      </div>

      {/* ══ CIRCULAR NAV — bottom center ══════════════ */}
      <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 48 }}>

        {/* arc items */}
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
                transition: `transform 0.42s cubic-bezier(0.34,1.56,0.64,1) ${i*45}ms, opacity 0.24s ease ${i*30}ms`,
                zIndex: 49,
              }}
            >
              {/* tooltip */}
              <div style={{
                position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,12,5,0.97)", border: "1px solid rgba(0,200,100,0.16)",
                borderRadius: 4, padding: "3px 9px",
                fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.12em",
                color: "#00D47A", whiteSpace: "nowrap", pointerEvents: "none",
                opacity: navOpen ? 1 : 0,
                transition: `opacity 0.18s ease ${i*45+130}ms`,
              }}>{item.label}</div>

              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: isAct ? "rgba(0,200,100,0.2)" : "rgba(0,12,5,0.94)",
                border: `1px solid ${isAct ? "rgba(0,200,100,0.45)" : "rgba(0,200,100,0.17)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", backdropFilter: "blur(14px)",
                boxShadow: isAct ? "0 0 14px rgba(0,200,100,0.16)" : "none",
                transition: "all 0.2s",
              }}>
                <Icon size={14} color={isAct ? "#00D47A" : "rgba(0,200,100,0.42)"} />
              </div>
            </div>
          );
        })}

        {/* central toggle */}
        <div
          onClick={() => setNavOpen(v => !v)}
          style={{
            position: "relative", zIndex: 50,
            width: 48, height: 48, borderRadius: "50%",
            background: navOpen ? "rgba(0,200,100,0.17)" : "rgba(0,12,5,0.94)",
            border: `1px solid ${navOpen ? "rgba(0,200,100,0.42)" : "rgba(0,200,100,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(18px)",
            boxShadow: navOpen ? "0 0 22px rgba(0,200,100,0.13)" : "none",
            transition: "all 0.26s ease",
          }}
        >
          {navOpen ? <X size={16} color="#00D47A" /> : <Menu size={16} color="rgba(0,200,100,0.52)" />}
        </div>
      </div>

    </div>
  );
}
