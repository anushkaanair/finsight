"use client";
import { useState, Suspense, lazy } from "react";
import {
  Home, BarChart2, Shield, Database,
  MessageCircle, Search, X, Menu,
  Zap, FileText,
} from "lucide-react";
import { Chatbot } from "@/components/ui/chatbot";

const SplineScene = lazy(() => import("@/components/ui/splite"));

/* ── types ── */
interface SentimentScore { positive: number; negative: number; neutral: number; }
interface AnalysisResult {
  ticker: string;
  quarter: string;
  sentiment: { label: string; score: SentimentScore };
  guidance: { text: string; tag: string }[];
  risk_delta: { added: string[]; removed: string[]; modified: [string, string][] };
  brief: string;
}

/* ── circular nav config ── */
const NAV = [
  { icon: Home,          label: "OVERVIEW", id: "home",     angle: 270, r: 90 },
  { icon: BarChart2,     label: "ANALYSIS", id: "analysis", angle: 234, r: 90 },
  { icon: Shield,        label: "RISK",     id: "risk",     angle: 306, r: 90 },
  { icon: Database,      label: "RESEARCH", id: "research", angle: 198, r: 90 },
  { icon: MessageCircle, label: "CHAT",     id: "chat",     angle: 342, r: 90 },
];

function circPos(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

/* ── shared styles ── */
const BAR_COLOR: Record<string, string> = {
  positive: "#00FF94", negative: "#FF4D73", neutral: "#FFB627",
};
const TAG_STYLE: Record<string, React.CSSProperties> = {
  optimistic: { background: "rgba(0,255,148,0.09)",  border: "1px solid rgba(0,255,148,0.28)",  color: "#00FF94" },
  cautious:   { background: "rgba(255,77,115,0.09)", border: "1px solid rgba(255,77,115,0.28)", color: "#FF4D73" },
  neutral:    { background: "rgba(255,182,39,0.09)", border: "1px solid rgba(255,182,39,0.28)", color: "#FFB627" },
};
const PANEL: React.CSSProperties = {
  background: "rgba(0, 14, 7, 0.90)",
  border: "1px solid rgba(0,200,100,0.14)",
  borderRadius: 10,
  backdropFilter: "blur(16px)",
  padding: 20,
};
const MONO_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9, letterSpacing: "0.22em",
  color: "rgba(0,200,100,0.48)",
  textTransform: "uppercase" as const,
  marginBottom: 14,
};

/* ═══════════════════════════════════════════════ */
export default function Page() {
  const [ticker,   setTicker]  = useState("");
  const [quarter,  setQuarter] = useState("Q1-2024");
  const [loading,  setLoading] = useState(false);
  const [result,   setResult]  = useState<AnalysisResult | null>(null);
  const [error,    setError]   = useState("");
  const [navOpen,  setNavOpen] = useState(false);
  const [active,   setActive]  = useState("home");

  const analyze = async () => {
    if (!ticker.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), quarter }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setResult(await res.json());
      setActive("analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed — start Flask first.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#030C06", overflow: "hidden" }}>

      {/* ═══════════════ BACKGROUND ORBS ═══════════════ */}
      {/* Orb 1 — large, top-left, vivid emerald */}
      <div style={{
        position: "fixed",
        top: -240, left: -240,
        width: 780, height: 780,
        borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,220,110,0.28) 0%, rgba(0,180,90,0.10) 40%, transparent 68%)",
        filter: "blur(60px)",
        pointerEvents: "none", zIndex: 0,
      }} />
      {/* Orb 2 — medium, bottom-right, teal */}
      <div style={{
        position: "fixed",
        bottom: -160, right: -160,
        width: 580, height: 580,
        borderRadius: "50%",
        background: "radial-gradient(circle at center, rgba(0,160,100,0.22) 0%, rgba(0,100,60,0.08) 45%, transparent 68%)",
        filter: "blur(50px)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ═══════════════ HEADER ═══════════════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 54,
        background: "rgba(3,12,6,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,200,100,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: "rgba(0,200,100,0.10)",
            border: "1px solid rgba(0,200,100,0.26)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={11} color="#00D68F" />
          </div>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 19, letterSpacing: "0.18em", color: "#00D68F",
          }}>FINSIGHT</span>
        </div>

        <nav style={{ display: "flex", gap: 36 }}>
          {["Overview", "Research", "Risk", "Chat"].map(n => (
            <button key={n} style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: "rgba(180,220,195,0.35)",
              background: "none", border: "none", cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00D68F")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(180,220,195,0.35)")}
            >{n}</button>
          ))}
        </nav>

        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          fontFamily: "var(--font-mono)", fontSize: 9,
          letterSpacing: "0.14em", color: "rgba(0,214,143,0.5)",
        }}>
          <span className="animate-pulse" style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#00D68F", display: "inline-block",
          }} />
          SYSTEM ONLINE
        </div>
      </header>

      {/* ═══════════════ HERO ═════════════════════════ */}
      <section style={{
        position: "relative", zIndex: 1,
        minHeight: "100vh",
        display: "flex", alignItems: "center",
        padding: "80px 48px 80px",
        gap: 0,
        maxWidth: 1320, margin: "0 auto",
      }}>

        {/* ── Left: heading + form ── */}
        <div style={{ flex: "0 0 500px", display: "flex", flexDirection: "column", gap: 26 }}>

          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.38em", color: "rgba(0,200,100,0.55)",
            textTransform: "uppercase",
          }}>SEC EDGAR · FINBERT NLP · FAISS RAG</p>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(64px, 8vw, 106px)",
            lineHeight: 0.90, color: "#C8DDD0",
            letterSpacing: "0.025em",
          }}>
            AUTOMATED<br />
            <span style={{ color: "#00D68F" }}>EQUITY</span><br />
            RESEARCH
          </h1>

          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 13,
            lineHeight: 1.8, color: "rgba(180,220,195,0.45)",
            maxWidth: 380,
          }}>
            Ingest SEC 10-K/10-Q filings, score MD&amp;A sentiment with FinBERT,
            detect risk factor changes Q-over-Q, and generate source-cited analyst
            briefs — entirely free, runs on CPU.
          </p>

          {/* ── Search form ── */}
          <div style={{ ...PANEL, padding: 20 }}>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {/* Ticker */}
              <div style={{ flex: 1 }}>
                <label style={{ ...MONO_LABEL, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  Stock Ticker
                  <span
                    title="A stock ticker is a short symbol that identifies a publicly traded company. Examples: AAPL = Apple, MSFT = Microsoft, NVDA = NVIDIA, AMZN = Amazon, TSLA = Tesla, JPM = JPMorgan."
                    style={{ cursor: "help", color: "rgba(0,200,100,0.3)", fontSize: 11 }}
                  >ⓘ</span>
                </label>
                <input
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder="e.g. AAPL, MSFT, NVDA"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(0,200,100,0.16)",
                    borderRadius: 7, padding: "9px 12px",
                    fontFamily: "var(--font-mono)", fontSize: 13,
                    color: "#C8DDD0", outline: "none", letterSpacing: "0.05em",
                  }}
                />
              </div>
              {/* Quarter */}
              <div>
                <label style={{ ...MONO_LABEL, marginBottom: 6 }}>Quarter</label>
                <select
                  value={quarter}
                  onChange={e => setQuarter(e.target.value)}
                  style={{
                    background: "#030C06",
                    border: "1px solid rgba(0,200,100,0.16)",
                    borderRadius: 7, padding: "9px 10px",
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: "#C8DDD0", outline: "none",
                  }}
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
              style={{
                width: "100%",
                background: loading || !ticker.trim() ? "rgba(0,200,100,0.05)" : "rgba(0,200,100,0.12)",
                border: "1px solid rgba(0,200,100,0.26)",
                borderRadius: 7, padding: "11px 0",
                fontFamily: "var(--font-mono)", fontSize: 11,
                letterSpacing: "0.14em", color: "#00D68F",
                cursor: loading || !ticker.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.2s",
              }}
            >
              {loading
                ? <><span className="loader" /> ANALYZING…</>
                : <><Search size={12} /> RUN ANALYSIS</>
              }
            </button>

            {error && (
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "#FF4D73", marginTop: 8, letterSpacing: "0.04em",
              }}>✗ {error}</p>
            )}

            {/* Quick tickers */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 8,
                color: "rgba(0,200,100,0.32)", letterSpacing: "0.2em",
              }}>TRY →</span>
              {["AAPL","MSFT","NVDA","AMZN","TSLA"].map(t => (
                <button key={t} onClick={() => setTicker(t)} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  padding: "2px 7px",
                  border: "1px solid rgba(0,200,100,0.16)",
                  borderRadius: 4, background: "transparent",
                  color: "rgba(0,200,100,0.5)", cursor: "pointer",
                  letterSpacing: "0.07em",
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Quick stats after analysis */}
          {result && (
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "SENTIMENT", value: result.sentiment.label.toUpperCase(), color: BAR_COLOR[result.sentiment.label] ?? "#00D68F" },
                { label: "GUIDANCE",  value: `${result.guidance.length} SIGNALS`,  color: "#FFB627" },
                { label: "RISK Δ",    value: `+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`, color: "#00FF94" },
              ].map(m => (
                <div key={m.label} style={{ ...PANEL, flex: 1, padding: "11px 13px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,200,100,0.42)", marginBottom: 5 }}>{m.label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: m.color, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: single robot + floating chips ── */}
        <div style={{
          flex: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", minHeight: 480,
        }}>
          {/* Soft inner glow */}
          <div style={{
            position: "absolute",
            width: 320, height: 320, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,200,100,0.07) 0%, transparent 70%)",
            filter: "blur(24px)", pointerEvents: "none",
          }} />

          {/* Robot — one, centered */}
          <div className="animate-float" style={{ width: 400, height: 400, opacity: 0.92 }}>
            <Suspense fallback={
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="loader" style={{ width: 26, height: 26, borderWidth: 3 }} />
              </div>
            }>
              <SplineScene />
            </Suspense>
          </div>

          {/* Chip — top right */}
          <div style={{
            position: "absolute", top: "6%", right: "8%",
            ...PANEL, padding: "10px 14px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,200,100,0.42)", marginBottom: 4 }}>SENTIMENT</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#00FF94", fontWeight: 700 }}>POSITIVE</div>
          </div>

          {/* Chip — bottom left */}
          <div style={{
            position: "absolute", bottom: "12%", left: "5%",
            ...PANEL, padding: "10px 14px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,200,100,0.42)", marginBottom: 4 }}>RISK Δ</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "#FFB627", fontWeight: 700 }}>+3 / −1</div>
          </div>

          {/* Chip — mid left */}
          <div style={{
            position: "absolute", top: "40%", left: "3%",
            ...PANEL, padding: "10px 14px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", color: "rgba(0,200,100,0.42)", marginBottom: 4 }}>FINBERT</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#00D68F" }}>84.2% CONF</div>
          </div>
        </div>
      </section>

      {/* ═══════════════ RESULTS ══════════════════════ */}
      {result && (
        <section style={{
          position: "relative", zIndex: 1,
          padding: "0 48px 160px",
          maxWidth: 1320, margin: "0 auto",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 20, paddingBottom: 14,
            borderBottom: "1px solid rgba(0,200,100,0.09)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00D68F", display: "inline-block" }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: "0.2em", color: "rgba(0,200,100,0.52)",
            }}>ANALYSIS — {result.ticker} · {result.quarter}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Sentiment */}
            <div style={PANEL}>
              <p style={MONO_LABEL}>FINBERT SENTIMENT</p>
              {(["positive","negative","neutral"] as const).map(k => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(180,220,195,0.52)", textTransform: "capitalize" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: BAR_COLOR[k] }}>
                      {(result.sentiment.score[k] * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 3, background: "rgba(0,200,100,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${result.sentiment.score[k] * 100}%`, background: BAR_COLOR[k], transition: "width 1.2s ease" }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,200,100,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(0,200,100,0.38)" }}>VERDICT</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: BAR_COLOR[result.sentiment.label] ?? "#00D68F", letterSpacing: "0.08em" }}>
                  {result.sentiment.label.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Risk delta */}
            <div style={PANEL}>
              <p style={MONO_LABEL}>RISK FACTOR Δ — Q-OVER-Q</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Added",    count: result.risk_delta.added.length,    color: "#00FF94" },
                  { label: "Removed",  count: result.risk_delta.removed.length,  color: "#FF4D73" },
                  { label: "Modified", count: result.risk_delta.modified.length, color: "#FFB627" },
                ].map(d => (
                  <div key={d.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "13px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: d.color }}>{d.count}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, color: "rgba(180,220,195,0.36)", marginTop: 4 }}>{d.label}</div>
                  </div>
                ))}
              </div>
              {result.risk_delta.added.slice(0, 2).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <span style={{ color: "#00FF94", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>+</span>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(180,220,195,0.46)", lineHeight: 1.55 }}>
                    {s.slice(0, 112)}{s.length > 112 ? "…" : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* Guidance */}
            <div style={PANEL}>
              <p style={MONO_LABEL}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
              {result.guidance.length === 0
                ? <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(0,200,100,0.22)" }}>NO SIGNALS DETECTED</p>
                : (
                  <div style={{ maxHeight: 175, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {result.guidance.slice(0, 6).map((g, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 8,
                          padding: "2px 7px", borderRadius: 3, flexShrink: 0,
                          letterSpacing: "0.1em",
                          ...TAG_STYLE[g.tag],
                        }}>{g.tag.toUpperCase()}</span>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "rgba(180,220,195,0.5)", lineHeight: 1.55 }}>
                          {g.text.slice(0, 95)}{g.text.length > 95 ? "…" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Brief */}
            <div style={PANEL}>
              <p style={MONO_LABEL}>ANALYST BRIEF</p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "rgba(180,220,195,0.58)", lineHeight: 1.85 }}>
                {result.brief}
              </p>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,200,100,0.08)" }}>
                <button style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em",
                  color: "#00D68F", background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <FileText size={10} /> EXPORT PDF
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ CIRCULAR NAV ═════════════════ */}
      <div style={{
        position: "fixed", bottom: 28, left: "50%",
        transform: "translateX(-50%)", zIndex: 50,
      }}>
        {/* Radial items */}
        {NAV.map((item, i) => {
          const { x, y } = circPos(item.angle, item.r);
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <div
              key={item.id}
              onClick={() => { setActive(item.id); setNavOpen(false); }}
              style={{
                position: "absolute",
                left: "50%", bottom: "50%",
                transform: navOpen
                  ? `translate(calc(-50% + ${x}px), calc(50% + ${y}px))`
                  : "translate(-50%, 50%)",
                opacity: navOpen ? 1 : 0,
                pointerEvents: navOpen ? "auto" : "none",
                transition: `transform 0.42s cubic-bezier(0.34,1.56,0.64,1) ${i * 45}ms, opacity 0.25s ease ${i * 30}ms`,
                zIndex: 51,
              }}
            >
              {/* Tooltip above each item */}
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 7px)", left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0,14,6,0.96)",
                border: "1px solid rgba(0,200,100,0.18)",
                borderRadius: 4, padding: "3px 9px",
                fontFamily: "var(--font-mono)", fontSize: 8,
                letterSpacing: "0.12em", color: "#00D68F",
                whiteSpace: "nowrap",
                opacity: navOpen ? 1 : 0,
                transition: `opacity 0.2s ease ${i * 45 + 120}ms`,
                pointerEvents: "none",
              }}>{item.label}</div>

              {/* Icon button */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: isActive ? "rgba(0,200,100,0.22)" : "rgba(0,14,6,0.94)",
                border: `1px solid ${isActive ? "rgba(0,200,100,0.48)" : "rgba(0,200,100,0.18)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", backdropFilter: "blur(14px)",
                boxShadow: isActive ? "0 0 14px rgba(0,200,100,0.18)" : "none",
                transition: "all 0.2s",
              }}>
                <Icon size={14} color={isActive ? "#00D68F" : "rgba(0,200,100,0.44)"} />
              </div>
            </div>
          );
        })}

        {/* Central toggle */}
        <div
          onClick={() => setNavOpen(v => !v)}
          style={{
            position: "relative", zIndex: 52,
            width: 50, height: 50, borderRadius: "50%",
            background: navOpen ? "rgba(0,200,100,0.18)" : "rgba(0,14,6,0.94)",
            border: `1px solid ${navOpen ? "rgba(0,200,100,0.44)" : "rgba(0,200,100,0.22)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(18px)",
            boxShadow: navOpen ? "0 0 22px rgba(0,200,100,0.14)" : "none",
            transition: "all 0.28s ease",
          }}
        >
          {navOpen ? <X size={16} color="#00D68F" /> : <Menu size={16} color="rgba(0,200,100,0.55)" />}
        </div>
      </div>

      {/* ═══════════════ CHATBOT ══════════════════════ */}
      <Chatbot />
    </div>
  );
}
