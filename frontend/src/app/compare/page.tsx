"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, ArrowLeft, Plus, X, Search, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { compareTickersAPI } from "@/lib/api";
import type { CompareResult, CompareEntry } from "@/types/brief";

const C = {
  bg:       "#05080A",
  surface:  "rgba(9,13,18,0.97)",
  surface2: "rgba(12,17,23,0.98)",
  accent:   "#00C896",
  accentHi: "#00E8AA",
  pos:      "#00D47A",
  neg:      "#E03B50",
  neu:      "#D4900A",
  border:   "rgba(0,150,100,0.11)",
  borderHi: "rgba(0,190,130,0.30)",
  text:     "#D0DDE5",
  text2:    "#96AABA",
  muted:    "rgba(140,170,190,0.42)",
};

const QUARTERS = [
  "Q1-2023","Q2-2023","Q3-2023","Q4-2023",
  "Q1-2024","Q2-2024","Q3-2024","Q4-2024",
  "Q1-2025","Q2-2025",
];

const PRESETS = [
  { label:"FAANG",    tickers:["AAPL","AMZN","META","GOOGL"] },
  { label:"Big Tech", tickers:["MSFT","AAPL","NVDA","GOOGL"] },
  { label:"Banks",    tickers:["JPM","BAC","GS","MS"]         },
  { label:"EV",       tickers:["TSLA","RIVN","NIO","LCID"]    },
];

const panel: React.CSSProperties = {
  background:C.surface,
  border:`1px solid ${C.border}`,
  borderRadius:10,
  backdropFilter:"blur(24px)",
};

/* ── Tilt card ─────────────────────────────────────────────── */
function TiltCard({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  const ref=useRef<HTMLDivElement>(null);
  const [tilt,setTilt]=useState({x:0,y:0,on:false});
  const [glow,setGlow]=useState({x:"50%",y:"50%"});
  const onMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    const el=ref.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const nx=(e.clientX-r.left)/r.width, ny=(e.clientY-r.top)/r.height;
    setTilt({x:-(ny-0.5)*7,y:(nx-0.5)*7,on:true});
    setGlow({x:`${nx*100}%`,y:`${ny*100}%`});
  };
  return(
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={()=>setTilt({x:0,y:0,on:false})}
      animate={{rotateX:tilt.x,rotateY:tilt.y,scale:tilt.on?1.012:1}}
      transition={{type:"spring",stiffness:380,damping:26,mass:0.45}}
      style={{...style,transformStyle:"preserve-3d",position:"relative"}}
      className="result-card"
    >
      {tilt.on&&<div style={{position:"absolute",inset:0,borderRadius:"inherit",pointerEvents:"none",zIndex:0,background:`radial-gradient(circle at ${glow.x} ${glow.y},rgba(0,200,150,0.08) 0%,transparent 58%)`}}/>}
      <div style={{position:"relative",zIndex:1,height:"100%"}}>{children}</div>
    </motion.div>
  );
}

/* ── Animated sentiment bar ──────────────────────────────────── */
function SentBar({label:l,score,i}:{label:string;score:{positive:number;negative:number;neutral:number};i:number}){
  const col={positive:C.pos,negative:C.neg,neutral:C.neu}[l as "positive"|"negative"|"neutral"]||C.accentHi;
  const pct=((score[l as keyof typeof score]??0)*100).toFixed(0);
  return(
    <div style={{marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontFamily:"var(--font-mono)",fontSize:8,color:C.muted,textTransform:"capitalize"}}>{l}</span>
        <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:col,fontWeight:700}}>{pct}%</span>
      </div>
      <div style={{height:2.5,background:"rgba(0,150,100,0.07)",borderRadius:2,overflow:"hidden"}}>
        <motion.div
          initial={{width:0}}
          animate={{width:`${pct}%`}}
          transition={{duration:1.2,ease:"easeOut",delay:i*0.12}}
          style={{height:"100%",borderRadius:2,background:col}}
        />
      </div>
    </div>
  );
}

/* ── Compare card ─────────────────────────────────────────────── */
function CompareCard({ticker,entry,index}:{ticker:string;entry:CompareEntry;index:number}){
  const lbl=entry.sentiment.label;
  const sentColor={positive:C.pos,negative:C.neg,neutral:C.neu}[lbl]||C.accentHi;
  const sentIcon=lbl==="positive"?<TrendingUp size={13} color={C.pos}/>:lbl==="negative"?<TrendingDown size={13} color={C.neg}/>:<Minus size={13} color={C.neu}/>;
  const labelS: React.CSSProperties = {fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.22em",color:"rgba(0,200,150,0.42)",marginBottom:10,textTransform:"uppercase"};
  return(
    <TiltCard style={{...panel,overflow:"hidden",display:"flex",flexDirection:"column",borderTop:`2px solid ${sentColor}`}}>
      <motion.div
        initial={{opacity:0,y:18}} animate={{opacity:1,y:0}}
        transition={{delay:index*0.1,duration:0.4}}
      >
        {/* Card header */}
        <div style={{padding:"18px 20px",background:"rgba(0,0,0,0.32)",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"var(--font-display)",fontSize:30,color:C.text,letterSpacing:"0.06em",fontWeight:800}}>{ticker}</div>
            {entry.market?.price&&(
              <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:C.accentHi,marginTop:2}}>
                ${entry.market.price.toFixed(2)}
                {entry.market.pe_ratio&&<span style={{color:C.muted,marginLeft:10}}>P/E {entry.market.pe_ratio.toFixed(1)}</span>}
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {sentIcon}
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:sentColor,fontWeight:700,letterSpacing:"0.08em"}}>{lbl.toUpperCase()}</span>
          </div>
        </div>

        <div style={{padding:"18px 20px",display:"flex",flexDirection:"column",gap:18,flex:1}}>
          {/* Sentiment */}
          <div>
            <p style={labelS}>SENTIMENT</p>
            <SentBar label="positive" score={entry.sentiment.score} i={0}/>
            <SentBar label="negative" score={entry.sentiment.score} i={1}/>
            <SentBar label="neutral"  score={entry.sentiment.score} i={2}/>
          </div>

          {/* Risk */}
          <div>
            <p style={labelS}>RISK Δ</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[{l:"Added",n:entry.risk_added,c:C.neg},{l:"Removed",n:entry.risk_removed,c:C.pos}].map(d=>(
                <div key={d.l} style={{background:"rgba(0,0,0,0.45)",border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:"var(--font-display)",fontSize:26,fontWeight:800,color:d.c,lineHeight:1}}>{d.n}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:7,color:C.muted,marginTop:5,letterSpacing:"0.1em"}}>{d.l.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Guidance */}
          <div>
            <p style={labelS}>GUIDANCE</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[
                {l:"OPT",n:entry.optimistic_count,c:C.pos},
                {l:"CAU",n:entry.cautious_count,  c:C.neg},
                {l:"NEU",n:Math.max(0,entry.guidance_count-entry.optimistic_count-entry.cautious_count),c:C.neu},
              ].map(d=>(
                <div key={d.l} style={{background:"rgba(0,0,0,0.45)",border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 6px",textAlign:"center"}}>
                  <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,color:d.c,lineHeight:1}}>{d.n}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:7,color:C.muted,marginTop:4,letterSpacing:"0.1em"}}>{d.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financials */}
          {entry.financials?.available&&(
            <div>
              <p style={labelS}>FINANCIALS</p>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {[
                  {l:"Revenue",    v:entry.financials.revenue},
                  {l:"Net Income", v:entry.financials.net_income},
                  {l:"Gross Margin",v:entry.financials.gross_margin},
                  {l:"EPS Diluted",v:entry.financials.eps_diluted?`$${entry.financials.eps_diluted}`:undefined},
                ].filter(m=>m.v).map(m=>(
                  <div key={m.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid rgba(0,150,100,0.07)`}}>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.muted}}>{m.l}</span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:C.accentHi,fontWeight:700}}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brief */}
          <div>
            <p style={labelS}>BRIEF</p>
            <p style={{fontFamily:"var(--font-sans)",fontSize:11.5,color:"rgba(150,170,186,0.65)",lineHeight:1.75,margin:0}}>{entry.brief.slice(0,200)}…</p>
          </div>
        </div>
      </motion.div>
    </TiltCard>
  );
}

/* ════════════════════════════════════════════════════════════ */
export default function ComparePage(){
  const [tickers, setTickers] = useState<string[]>(["AAPL","MSFT"]);
  const [input,   setInput]   = useState("");
  const [quarter, setQuarter] = useState("Q1-2024");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<CompareResult|null>(null);
  const [err,     setErr]     = useState("");

  function addTicker(){
    const t=input.trim().toUpperCase();
    if(!t||tickers.includes(t)||tickers.length>=4) return;
    setTickers(p=>[...p,t]); setInput("");
  }
  function removeTicker(t:string){ setTickers(p=>p.filter(x=>x!==t)); }
  async function compare(){
    if(tickers.length<2) return;
    setLoading(true); setErr(""); setResult(null);
    try{ setResult(await compareTickersAPI(tickers,quarter)); }
    catch(e){ setErr(e instanceof Error?e.message:"Comparison failed."); }
    finally{ setLoading(false); }
  }

  return(
    <div className="mesh-bg" style={{minHeight:"100vh",padding:"82px 52px 80px",overflowX:"hidden"}}>
      <div className="bg-grid" style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:0.55}}/>

      {/* Ambient glow */}
      <div style={{position:"fixed",top:-200,left:-200,zIndex:0,pointerEvents:"none",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,150,0.06) 0%,transparent 65%)",filter:"blur(70px)"}}/>

      {/* Header */}
      <header style={{
        position:"fixed",top:0,left:0,right:0,zIndex:40,
        background:"rgba(5,8,10,0.95)",backdropFilter:"blur(32px)",
        borderBottom:`1px solid ${C.border}`,
        height:54,display:"flex",alignItems:"center",padding:"0 44px",gap:16,
      }}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:6,color:C.muted,textDecoration:"none",fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.14em",transition:"color 0.16s"}}
        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=C.accentHi}
        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=C.muted}
        >
          <ArrowLeft size={13}/> BACK
        </Link>
        <div style={{width:1,height:20,background:C.border}}/>
        <div style={{width:28,height:28,borderRadius:7,background:"rgba(0,200,150,0.07)",border:`1px solid rgba(0,200,150,0.18)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Zap size={12} color={C.accentHi}/>
        </div>
        <span style={{fontFamily:"var(--font-display)",fontSize:19,letterSpacing:"0.24em",color:C.text,fontWeight:800}}>FINSIGHT</span>
        <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.16em",color:C.muted}}>· MULTI-TICKER COMPARISON</span>
      </header>

      <div style={{position:"relative",zIndex:1,maxWidth:1240,margin:"0 auto"}}>

        {/* Title */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{marginBottom:32}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <BarChart2 size={20} color={C.accentHi}/>
            <h1 style={{fontFamily:"var(--font-display)",fontSize:40,letterSpacing:"0.08em",color:C.text,fontWeight:800,margin:0}}>SIDE-BY-SIDE ANALYSIS</h1>
          </div>
          <p style={{fontFamily:"var(--font-sans)",fontSize:13.5,color:"rgba(150,170,186,0.58)",fontWeight:300,margin:0}}>
            Compare up to 4 tickers simultaneously — sentiment, risk delta, guidance signals, and financial metrics.
          </p>
        </motion.div>

        {/* Controls panel */}
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.1}} style={{...panel,padding:24,marginBottom:28,borderLeft:`2px solid ${C.accent}`}}>
          {/* Presets */}
          <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
            <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.18em",color:C.muted}}>PRESETS</span>
            {PRESETS.map(p=>(
              <button key={p.label} onClick={()=>setTickers(p.tickers.slice(0,4))} style={{
                fontFamily:"var(--font-mono)",fontSize:9,padding:"4px 13px",
                border:`1px solid ${C.border}`,borderRadius:4,
                background:"transparent",color:C.muted,cursor:"pointer",transition:"all 0.14s",
              }}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.text;el.style.borderColor=C.borderHi;el.style.background="rgba(0,200,150,0.05)";}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.muted;el.style.borderColor=C.border;el.style.background="transparent";}}
              >{p.label}</button>
            ))}
          </div>

          <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
            {/* Ticker chips */}
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.22em",color:"rgba(0,200,150,0.42)",marginBottom:10}}>
                TICKERS ({tickers.length}/4)
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <AnimatePresence>
                  {tickers.map(t=>(
                    <motion.div key={t} initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,200,150,0.08)",border:`1px solid ${C.borderHi}`,borderRadius:20,padding:"4px 12px"}}>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:C.accentHi,fontWeight:700}}>{t}</span>
                      <button onClick={()=>removeTicker(t)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex"}}><X size={11} color={C.muted}/></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {tickers.length<4&&(
                  <div style={{display:"flex",gap:6}}>
                    <input
                      value={input} onChange={e=>setInput(e.target.value.toUpperCase())}
                      onKeyDown={e=>e.key==="Enter"&&addTicker()}
                      placeholder="ADD TICKER"
                      className="input-terminal"
                      style={{width:120,background:"rgba(0,0,0,0.55)",border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 14px",fontFamily:"var(--font-mono)",fontSize:11,color:C.text,letterSpacing:"0.08em"}}
                    />
                    <button onClick={addTicker} style={{background:"rgba(0,200,150,0.08)",border:`1px solid ${C.borderHi}`,borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.16s"}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,200,150,0.16)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,200,150,0.08)"}
                    ><Plus size={13} color={C.accentHi}/></button>
                  </div>
                )}
              </div>
            </div>

            {/* Quarter */}
            <div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.22em",color:"rgba(0,200,150,0.42)",marginBottom:10}}>QUARTER</div>
              <select value={quarter} onChange={e=>setQuarter(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 10px",fontFamily:"var(--font-mono)",fontSize:11,color:C.text,outline:"none",cursor:"pointer"}}>
                {QUARTERS.map(q=><option key={q} value={q}>{q}</option>)}
              </select>
            </div>

            {/* Compare button */}
            <motion.button
              whileHover={{scale:tickers.length<2?1:1.02}}
              whileTap={{scale:0.98}}
              onClick={compare}
              disabled={loading||tickers.length<2}
              style={{
                background:tickers.length<2?"rgba(0,200,150,0.03)":"rgba(0,200,150,0.10)",
                border:`1px solid ${tickers.length<2?C.border:C.borderHi}`,
                borderRadius:7,padding:"10px 26px",
                fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.18em",
                color:tickers.length<2?C.muted:C.accentHi,
                cursor:tickers.length<2?"not-allowed":"pointer",
                display:"flex",alignItems:"center",gap:8,
                opacity:tickers.length<2?0.45:1,
                transition:"all 0.18s",
              }}
            >
              {loading?<><span className="loader"/> ANALYZING…</>:<><Search size={12}/> COMPARE</>}
            </motion.button>
          </div>

          {err&&<p style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.neg,marginTop:10,letterSpacing:"0.08em"}}>✗ {err}</p>}
        </motion.div>

        {/* Per-ticker errors */}
        {result&&Object.keys(result.errors).length>0&&(
          <div style={{marginBottom:14}}>
            {Object.entries(result.errors).map(([t,e])=>(
              <p key={t} style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.neg,letterSpacing:"0.08em"}}>✗ {t}: {e}</p>
            ))}
          </div>
        )}

        {/* Results grid */}
        {result&&Object.keys(result.results).length>0&&(
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.35}}
            style={{display:"grid",gridTemplateColumns:`repeat(${Object.keys(result.results).length},1fr)`,gap:16}}
          >
            {Object.entries(result.results).map(([ticker,entry],i)=>(
              <CompareCard key={ticker} ticker={ticker} entry={entry} index={i}/>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {!result&&!loading&&(
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3}}
            style={{textAlign:"center",padding:"72px 0"}}
          >
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:"50%",background:"rgba(0,200,150,0.06)",border:`1px solid rgba(0,200,150,0.12)`,marginBottom:20}}>
              <BarChart2 size={24} color="rgba(0,200,150,0.3)"/>
            </div>
            <p style={{fontFamily:"var(--font-mono)",fontSize:10,color:C.muted,letterSpacing:"0.2em",marginBottom:8}}>
              SELECT TICKERS AND CLICK COMPARE
            </p>
            <p style={{fontFamily:"var(--font-sans)",fontSize:12,color:"rgba(140,170,190,0.28)"}}>
              Up to 4 tickers · Side-by-side analysis · Instant comparison
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
