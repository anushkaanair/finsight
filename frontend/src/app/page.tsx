"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Zap, FileText, Send, Brain,
  ChevronRight, Star, StarOff, Clock, TrendingUp,
  TrendingDown, Minus, BarChart2, Shield, Home,
  Database, MessageCircle, ExternalLink, RefreshCw, Menu,
  Activity,
} from "lucide-react";
import { SplineScene } from "@/components/ui/splite";
import {
  runAnalysis, sendChatMessage, fetchHistory,
  fetchWatchlist, addToWatchlist, removeFromWatchlist,
} from "@/lib/api";
import type { AnalysisResult, ChatMessage, HistoryItem, WatchlistItem } from "@/types/brief";

/* ─── Design tokens ──────────────────────────────────────────── */
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
const BAR: Record<string, string> = { positive: C.pos, negative: C.neg, neutral: C.neu };
const TAG_S: Record<string, React.CSSProperties> = {
  optimistic:{ background:"rgba(0,212,122,0.09)", border:"1px solid rgba(0,212,122,0.24)", color:C.pos },
  cautious:  { background:"rgba(224,59,80,0.09)",  border:"1px solid rgba(224,59,80,0.24)",  color:C.neg },
  neutral:   { background:"rgba(212,144,10,0.09)", border:"1px solid rgba(212,144,10,0.24)", color:C.neu },
};
const panel: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  backdropFilter: "blur(24px)",
};
const label: React.CSSProperties = {
  fontFamily:"var(--font-mono)", fontSize:9, letterSpacing:"0.24em",
  color:"rgba(0,200,150,0.42)", textTransform:"uppercase", marginBottom:12,
};

/* ─── Animation variants ──────────────────────────────────────── */
const fadeUpVariant = {
  hidden: { opacity:0, y:22 },
  show:   { opacity:1, y:0  },
};
const staggerContainer = {
  hidden:{},
  show:{ transition:{ staggerChildren:0.09, delayChildren:0.1 } },
};

/* ─── Helpers ─────────────────────────────────────────────────── */
function fmtMarketCap(n:number|null){
  if(!n) return "—";
  if(n>=1e12) return `$${(n/1e12).toFixed(2)}T`;
  if(n>=1e9)  return `$${(n/1e9).toFixed(1)}B`;
  return `$${(n/1e6).toFixed(0)}M`;
}

/* ─── Hooks ───────────────────────────────────────────────────── */
function useCountUp(target:number, duration=1100, trigger=false){
  const [v,setV] = useState(0);
  useEffect(()=>{
    if(!trigger){ setV(0); return; }
    setV(0);
    const t0 = performance.now();
    const step=(now:number)=>{
      const p = Math.min((now-t0)/duration,1);
      const e = 1-Math.pow(1-p,3);
      setV(Math.round(e*target));
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },[target,duration,trigger]);
  return v;
}

function useTypewriter(text:string, speed=11, trigger=false){
  const [out,setOut] = useState("");
  useEffect(()=>{
    if(!trigger){ setOut(""); return; }
    setOut("");
    let i=0;
    const id=setInterval(()=>{
      i++;
      setOut(text.slice(0,i));
      if(i>=text.length) clearInterval(id);
    },speed);
    return ()=>clearInterval(id);
  },[text,trigger]);
  return out;
}

/* ─── Background particles ────────────────────────────────────── */
function BackgroundParticles(){
  const pts = useMemo(()=>Array.from({length:28},(_,i)=>({
    id:i,
    left:`${5+Math.random()*90}%`,
    top:`${5+Math.random()*90}%`,
    size:Math.random()*1.8+0.6,
    dur:`${18+Math.random()*24}s`,
    delay:`${-(Math.random()*24)}s`,
    tx:`${(Math.random()-0.5)*18}px`,
    ty:`${-8-Math.random()*16}px`,
    op:Math.random()*0.35+0.15,
  })),[]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
      {pts.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:p.left,top:p.top,
          width:p.size,height:p.size,borderRadius:"50%",
          background:C.accentHi,
          opacity:p.op,
          boxShadow:`0 0 ${p.size*3}px ${C.accent}`,
          "--tx":p.tx,"--ty":p.ty,
          animation:`particleDrift ${p.dur} ${p.delay} ease-in-out infinite`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

/* ─── Signal bars ─────────────────────────────────────────────── */
function SignalBars(){
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:2,height:13,transformOrigin:"bottom"}}>
      {[0.35,0.55,0.75,0.9,1].map((h,i)=>(
        <div key={i} style={{
          width:3,height:`${h*100}%`,borderRadius:1,
          background:`rgba(0,200,150,${0.3+i*0.14})`,
          transformOrigin:"bottom",
          animation:`signalPulse ${1+i*0.22}s ${i*0.12}s ease-in-out infinite`,
        }}/>
      ))}
    </div>
  );
}

/* ─── Tilt card ───────────────────────────────────────────────── */
function TiltCard({children,style,className}:{children:React.ReactNode;style?:React.CSSProperties;className?:string}){
  const ref=useRef<HTMLDivElement>(null);
  const [tilt,setTilt]=useState({x:0,y:0,on:false});
  const [glow,setGlow]=useState({x:"50%",y:"50%"});
  const onMove=(e:React.MouseEvent<HTMLDivElement>)=>{
    const el=ref.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const nx=(e.clientX-r.left)/r.width;
    const ny=(e.clientY-r.top)/r.height;
    setTilt({x:-(ny-0.5)*7,y:(nx-0.5)*7,on:true});
    setGlow({x:`${nx*100}%`,y:`${ny*100}%`});
  };
  const onLeave=()=>setTilt({x:0,y:0,on:false});
  return(
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      animate={{rotateX:tilt.x,rotateY:tilt.y,scale:tilt.on?1.014:1}}
      transition={{type:"spring",stiffness:380,damping:26,mass:0.45}}
      style={{...style,transformStyle:"preserve-3d",position:"relative"}}
      className={`result-card ${className||""}`}
    >
      {tilt.on&&(
        <div style={{
          position:"absolute",inset:0,borderRadius:"inherit",pointerEvents:"none",zIndex:0,
          background:`radial-gradient(circle at ${glow.x} ${glow.y}, rgba(0,200,150,0.09) 0%, transparent 58%)`,
        }}/>
      )}
      <div style={{position:"relative",zIndex:1,height:"100%"}}>{children}</div>
    </motion.div>
  );
}

/* ─── Analysis loader ─────────────────────────────────────────── */
const LOAD_STEPS=[
  "Connecting to SEC EDGAR",
  "Resolving ticker → CIK",
  "Downloading 10-Q filing",
  "Parsing MD&A sections",
  "Running FinBERT NLP",
  "Computing Q-over-Q risk delta",
  "Extracting financial tables",
  "Building FAISS index",
  "Fetching live market data",
  "Assembling analyst brief",
];
function AnalysisLoader({ticker,quarter}:{ticker:string;quarter:string}){
  const [step,setStep]=useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setStep(s=>Math.min(s+1,LOAD_STEPS.length-1)),950);
    return()=>clearInterval(id);
  },[]);
  const pct=((step+1)/LOAD_STEPS.length)*100;
  return(
    <motion.div
      initial={{opacity:0,y:24}}
      animate={{opacity:1,y:0}}
      transition={{duration:0.4,ease:"easeOut"}}
      style={{
        background:"rgba(4,6,10,0.99)",
        border:`1px solid rgba(0,200,150,0.16)`,
        borderRadius:12,padding:"34px 40px",width:460,
        boxShadow:"0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(0,200,150,0.08)",
      }}
    >
      {/* Header */}
      <div style={{marginBottom:26}}>
        <p style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.3em",color:"rgba(0,200,150,0.42)",marginBottom:10,textTransform:"uppercase"}}>
          FinSight · Analysis Pipeline
        </p>
        <div style={{display:"flex",alignItems:"baseline",gap:14}}>
          <span style={{fontFamily:"var(--font-display)",fontSize:32,fontWeight:800,color:C.text,letterSpacing:"0.06em"}}>{ticker.toUpperCase()}</span>
          <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"rgba(0,200,150,0.55)",letterSpacing:"0.1em"}}>{quarter}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{height:2,background:"rgba(0,200,150,0.07)",borderRadius:2,marginBottom:26,overflow:"hidden"}}>
        <motion.div
          animate={{width:`${pct}%`}}
          transition={{duration:0.9,ease:"easeOut"}}
          style={{height:"100%",background:"linear-gradient(90deg,#00C896,#00E8AA)",borderRadius:2,position:"relative"}}
        >
          <div style={{position:"absolute",right:0,top:-3,width:6,height:8,borderRadius:2,background:C.accentHi,boxShadow:`0 0 8px ${C.accentHi}`}}/>
        </motion.div>
      </div>

      {/* Steps */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {LOAD_STEPS.map((s,i)=>{
          const done=i<step, active=i===step;
          return(
            <motion.div
              key={i}
              initial={{opacity:0,x:-8}}
              animate={{opacity:1,x:0}}
              transition={{delay:i*0.04}}
              style={{display:"flex",alignItems:"center",gap:12}}
            >
              {/* Dot */}
              <div className={done?"step-done":""}  style={{
                width:20,height:20,borderRadius:"50%",flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:done?"rgba(0,212,122,0.14)":active?"rgba(0,200,150,0.08)":"transparent",
                border:done?"1px solid rgba(0,212,122,0.42)":active?"1px solid rgba(0,200,150,0.38)":"1px solid rgba(0,200,150,0.10)",
                transition:"all 0.4s ease",
              }}>
                {done
                  ?<span style={{color:C.pos,fontSize:9,fontWeight:700}}>✓</span>
                  :active
                  ?<span className="loader" style={{width:8,height:8,borderWidth:1.5}}/>
                  :<span style={{width:4,height:4,borderRadius:"50%",background:"rgba(0,200,150,0.14)",display:"inline-block"}}/>
                }
              </div>
              {/* Label */}
              <span style={{
                fontFamily:"var(--font-mono)",fontSize:9.5,letterSpacing:"0.1em",
                color:done?C.pos:active?C.text:"rgba(150,170,186,0.22)",
                transition:"color 0.4s ease",
              }}>
                {s}
                {done&&<span style={{marginLeft:10,color:"rgba(0,212,122,0.38)",fontSize:8}}>done</span>}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
        <Activity size={10} color="rgba(0,200,150,0.45)"/>
        <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.18em",color:"rgba(0,200,150,0.38)"}}>
          EDGAR · FINBERT · FAISS · GROQ LLAMA-3
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Animated sentiment bar ──────────────────────────────────── */
function SentimentBar({label:l,value,color,delay=0,trigger=false}:{label:string;value:number;color:string;delay?:number;trigger?:boolean}){
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontFamily:"var(--font-sans)",fontSize:11,color:C.text2,textTransform:"capitalize"}}>{l}</span>
        <motion.span
          initial={{opacity:0}}
          animate={trigger?{opacity:1}:{opacity:0}}
          transition={{delay:delay+0.3}}
          style={{fontFamily:"var(--font-mono)",fontSize:12,color,fontWeight:700}}
        >
          {(value*100).toFixed(1)}%
        </motion.span>
      </div>
      <div style={{height:3,background:"rgba(0,150,100,0.07)",borderRadius:2,overflow:"hidden"}}>
        <motion.div
          initial={{width:0}}
          animate={trigger?{width:`${value*100}%`}:{width:0}}
          transition={{duration:1.3,ease:"easeOut",delay}}
          style={{height:"100%",borderRadius:2,background:color,position:"relative"}}
        >
          {value>0.05&&<div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:4,height:4,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}`}}/>}
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Stat counter card ───────────────────────────────────────── */
function StatCount({n,label:l,color,trigger}:{n:number;label:string;color:string;trigger:boolean}){
  const v=useCountUp(n,900,trigger);
  return(
    <div style={{background:"rgba(0,0,0,0.5)",border:`1px solid ${C.border}`,borderRadius:8,padding:"18px 10px",textAlign:"center"}}>
      <div
        className={trigger?"count-entry":""}
        style={{fontFamily:"var(--font-display)",fontSize:38,fontWeight:800,color,lineHeight:1,marginBottom:6}}
      >{v}</div>
      <div style={{fontFamily:"var(--font-mono)",fontSize:8,textTransform:"uppercase",letterSpacing:"0.14em",color:C.muted}}>{l}</div>
    </div>
  );
}

/* ─── Ticker tape data ────────────────────────────────────────── */
const TAPE=[
  {t:"AAPL",v:"$189.30",d:"+1.24%"},{t:"MSFT",v:"$415.20",d:"+0.87%"},
  {t:"NVDA",v:"$878.30",d:"+2.41%"},{t:"GOOGL",v:"$172.40",d:"-0.33%"},
  {t:"TSLA",v:"$177.90",d:"-1.07%"},{t:"META",v:"$507.60",d:"+0.62%"},
  {t:"JPM",v:"$193.80",d:"+0.45%"},{t:"AMZN",v:"$182.40",d:"+1.18%"},
  {t:"BRK.B",v:"$402.10",d:"+0.22%"},{t:"V",v:"$277.30",d:"+0.38%"},
  {t:"NFLX",v:"$624.80",d:"+1.65%"},{t:"AMD",v:"$164.20",d:"+3.10%"},
];

/* ══════════════════════════════════════════════════════════════ */
export default function Page(){
  /* ── state ── */
  const [ticker,   setTicker]   = useState("");
  const [quarter,  setQuarter]  = useState("Q1-2024");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<AnalysisResult|null>(null);
  const [err,      setErr]      = useState("");
  const [navOpen,  setNavOpen]  = useState(false);
  const [activeTab,setActiveTab]= useState<"overview"|"risk"|"guidance"|"financials"|"market">("overview");
  const [resultsReady,setResultsReady]=useState(false);

  /* chat */
  const [chatOpen,    setChatOpen]    = useState(true);
  const [msgs,        setMsgs]        = useState<ChatMessage[]>([
    {role:"assistant",content:"Analyst ready. Run a ticker analysis then ask me anything about the filing."},
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

  /* input beam */
  const [inputFocused,setInputFocused]=useState(false);

  /* cursor glow */
  const [cursor,setCursor]=useState({x:0,y:0});
  useEffect(()=>{
    const h=(e:MouseEvent)=>setCursor({x:e.clientX,y:e.clientY});
    window.addEventListener("mousemove",h,{passive:true});
    return()=>window.removeEventListener("mousemove",h);
  },[]);

  /* ── demo data ── */
  const DEMO_RESULT:AnalysisResult={
    ticker:"AAPL",quarter:"Q1-2024",
    generated_at:new Date().toISOString(),
    sentiment:{label:"positive",score:{positive:0.71,negative:0.14,neutral:0.15},trend:"up"},
    guidance:[
      {text:"We expect revenue in the range of $88–92 billion driven by strong iPhone 15 demand and services growth.",tag:"optimistic",offset:0},
      {text:"Macro headwinds and FX volatility may pressure gross margins by approximately 50 basis points.",tag:"cautious",offset:100},
      {text:"Services segment is projected to continue double-digit growth through fiscal 2024.",tag:"optimistic",offset:200},
      {text:"Supply chain constraints in certain component categories remain an ongoing risk factor.",tag:"cautious",offset:300},
      {text:"Capital expenditures expected to remain consistent with prior year levels.",tag:"neutral",offset:400},
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
      available:true,revenue:"$119.6B",net_income:"$33.9B",gross_profit:"$54.9B",
      operating_income:"$40.4B",eps_basic:"2.19",eps_diluted:"2.18",
      gross_margin:"45.9%",operating_margin:"33.8%",net_margin:"28.3%",
    },
    market:{ticker:"AAPL",price:189.30,pe_ratio:29.4,market_cap:2920000000000,"52w_high":199.62,"52w_low":164.08},
    brief:"Apple Q1-FY2024: $119.6B revenue (-1% YoY), EPS $2.18 beating consensus by $0.07. Services hit record $23.1B (+11% YoY). FinBERT sentiment skews positive (71%) on Services momentum and AI integration plans. Key new risks: EU DMA compliance costs and generative AI competition from Android. China exposure language hardened materially. Gross margin 45.9% remains robust. Maintain OVERWEIGHT — Services flywheel offsets hardware cyclicality.",
  };

  function loadDemo(){
    setTicker("AAPL"); setQuarter("Q1-2024");
    setResult(DEMO_RESULT); setChatCtx(DEMO_RESULT.brief);
    setActiveTab("overview"); setResultsReady(true);
    setTimeout(()=>resultsRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),200);
  }

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,chatOpen]);

  const loadHistory   = useCallback(async()=>{ setHistory(await fetchHistory(15)); },[]);
  const loadWatchlist = useCallback(async()=>{
    const w=await fetchWatchlist(); setWatchlist(w);
    if(ticker) setInWatchlist(w.some(i=>i.ticker===ticker.toUpperCase()));
  },[ticker]);
  useEffect(()=>{ loadHistory(); loadWatchlist(); },[loadHistory,loadWatchlist]);

  /* ── analyze ── */
  async function analyze(){
    if(!ticker.trim()) return;
    setLoading(true); setErr(""); setResult(null); setResultsReady(false);
    setTimeout(()=>resultsRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
    try{
      const r=await runAnalysis(ticker.trim().toUpperCase(),quarter);
      setResult(r); setChatCtx(r.brief); setActiveTab("overview");
      setTimeout(()=>setResultsReady(true),200);
      loadHistory();
    }catch(e){
      setErr(e instanceof Error?e.message:"Connection failed — is Flask running?");
    }finally{ setLoading(false); }
  }

  /* ── chat ── */
  async function sendChat(){
    const q=chatInput.trim(); if(!q||chatLoading) return;
    setChatInput("");
    setMsgs(p=>[...p,{role:"user",content:q}]);
    setChatLoading(true);
    try{
      const res=await sendChatMessage(q,ticker,chatCtx);
      setMsgs(p=>[...p,{role:"assistant",content:res.answer,sources:res.sources}]);
    }catch{
      setMsgs(p=>[...p,{role:"assistant",content:"Flask not reachable on port 5000."}]);
    }finally{ setChatLoading(false); }
  }

  async function toggleWatchlist(){
    if(!ticker.trim()) return;
    const t=ticker.trim().toUpperCase();
    if(inWatchlist){ await removeFromWatchlist(t); setInWatchlist(false); }
    else           { await addToWatchlist(t);       setInWatchlist(true);  }
    loadWatchlist();
  }

  /* typewriter brief */
  const briefText = useTypewriter(result?.brief||"",11,resultsReady);

  const sentTrend=result?.sentiment?.trend;

  /* ════════════════════════ RENDER ═══════════════════════════ */
  return(
    <div className="mesh-bg" style={{position:"relative",minHeight:"100vh",overflowX:"hidden"}}>

      {/* Cursor glow */}
      <div className="cursor-glow" style={{left:cursor.x,top:cursor.y}}/>

      {/* Grid texture */}
      <div className="bg-grid" style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",opacity:0.55}}/>

      {/* Particles */}
      <BackgroundParticles/>

      {/* ══ HEADER ══ */}
      <header style={{
        position:"fixed",top:0,left:0,right:0,zIndex:40,
        background:"rgba(5,8,10,0.95)",backdropFilter:"blur(32px)",
        borderBottom:`1px solid ${C.border}`,
      }}>
        {/* Main bar */}
        <div style={{height:54,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 44px"}}>

          {/* Logo */}
          <motion.div
            initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.6,ease:"easeOut"}}
            style={{display:"flex",alignItems:"center",gap:10}}
          >
            <div style={{width:32,height:32,borderRadius:8,background:"rgba(0,200,150,0.07)",border:`1px solid rgba(0,200,150,0.20)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Zap size={14} color={C.accentHi}/>
            </div>
            <span
              className="glitch-logo"
              style={{fontFamily:"var(--font-display)",fontSize:20,letterSpacing:"0.26em",color:C.text,fontWeight:800,cursor:"default"}}
            >FINSIGHT</span>
            <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.16em",color:C.muted,paddingLeft:10,borderLeft:`1px solid ${C.border}`,marginLeft:4}}>EQUITY INTELLIGENCE</span>
          </motion.div>

          {/* Nav */}
          <motion.nav
            initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.3,duration:0.5}}
            style={{display:"flex",gap:6,alignItems:"center"}}
          >
            {[
              {id:"history"  as const,label:"HISTORY",  icon:<Clock size={11}/>},
              {id:"watchlist"as const,label:"WATCHLIST",icon:<Star size={11}/>},
            ].map(n=>(
              <button key={n.id} onClick={()=>setSidePanel(p=>p===n.id?null:n.id)} style={{
                display:"flex",alignItems:"center",gap:5,
                fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.14em",
                color:sidePanel===n.id?C.accentHi:C.muted,
                background:sidePanel===n.id?"rgba(0,200,150,0.07)":"none",
                border:`1px solid ${sidePanel===n.id?C.borderHi:"transparent"}`,
                borderRadius:4,padding:"5px 11px",cursor:"pointer",transition:"all 0.16s",
              }}>
                {n.icon}{n.label}
                {n.id==="watchlist"&&watchlist.length>0&&(
                  <span style={{background:"rgba(0,200,150,0.15)",color:C.accentHi,borderRadius:10,padding:"0 5px",fontSize:8}}>{watchlist.length}</span>
                )}
              </button>
            ))}
            <a href="/compare" style={{
              display:"flex",alignItems:"center",gap:5,
              fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.14em",color:C.muted,
              border:"1px solid transparent",borderRadius:4,padding:"5px 11px",
              textDecoration:"none",transition:"all 0.16s",
            }}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.accentHi;el.style.borderColor=C.border;}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.muted;el.style.borderColor="transparent";}}
            >
              <BarChart2 size={11}/> COMPARE
            </a>
          </motion.nav>

          {/* Status */}
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.5}}
            style={{display:"flex",alignItems:"center",gap:8,fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.14em",color:"rgba(0,200,150,0.42)",padding:"4px 12px",border:`1px solid ${C.border}`,borderRadius:4}}
          >
            <SignalBars/>
            SYSTEM ONLINE
          </motion.div>
        </div>

        {/* Ticker tape */}
        <div style={{height:26,borderTop:`1px solid ${C.border}`,background:"rgba(0,0,0,0.28)",overflow:"hidden",display:"flex",alignItems:"center"}}>
          <div className="ticker-wrap" style={{flex:1}}>
            <div className="ticker-inner" style={{display:"inline-flex",alignItems:"center"}}>
              {[...TAPE,...TAPE].map((item,i)=>(
                <span key={i} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"0 28px",fontFamily:"var(--font-mono)",fontSize:9}}>
                  <span style={{color:C.accentHi,letterSpacing:"0.12em",fontWeight:700}}>{item.t}</span>
                  <span style={{color:C.text2}}>{item.v}</span>
                  <span style={{color:item.d.startsWith("+")?C.pos:C.neg,letterSpacing:"0.05em"}}>{item.d}</span>
                  <span style={{color:C.border,fontSize:6}}>◆</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══ SIDE PANEL ══ */}
      <AnimatePresence>
        {sidePanel&&(
          <motion.div
            initial={{x:320,opacity:0}} animate={{x:0,opacity:1}} exit={{x:320,opacity:0}}
            transition={{type:"spring",damping:28,stiffness:260}}
            style={{
              position:"fixed",top:80,right:0,bottom:0,zIndex:38,
              width:300,background:"rgba(6,9,14,0.99)",
              borderLeft:`1px solid ${C.border}`,overflowY:"auto",
            }}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.22em",color:C.accentHi}}>
                {sidePanel==="history"?"RECENT ANALYSES":"WATCHLIST"}
              </span>
              <button onClick={()=>setSidePanel(null)} style={{background:"none",border:"none",cursor:"pointer"}}><X size={13} color={C.muted}/></button>
            </div>

            {sidePanel==="history"&&(
              <div style={{padding:"8px 0"}}>
                {history.length===0&&<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11,padding:"16px 18px"}}>No analyses yet.</p>}
                {history.map((h,i)=>(
                  <button key={i} onClick={()=>{setTicker(h.ticker);setQuarter(h.quarter);setSidePanel(null);}} style={{
                    width:"100%",textAlign:"left",padding:"11px 18px",
                    background:"none",border:"none",cursor:"pointer",
                    borderBottom:`1px solid ${C.border}`,transition:"background 0.14s",
                  }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,200,150,0.04)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="none"}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:C.text,fontWeight:700}}>{h.ticker}</span>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:8,color:BAR[h.sentiment_label]||C.muted,letterSpacing:"0.1em"}}>{h.sentiment_label?.toUpperCase()}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.muted}}>{h.quarter}</span>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:8,color:C.muted}}>{new Date(h.generated_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {sidePanel==="watchlist"&&(
              <div style={{padding:"8px 0"}}>
                {watchlist.length===0&&<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11,padding:"16px 18px"}}>Star a ticker after analysis to watch it.</p>}
                {watchlist.map((w,i)=>(
                  <div key={i} style={{padding:"11px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:C.text,fontWeight:700}}>{w.ticker}</span>
                        {w.sentiment_label&&<span style={{fontFamily:"var(--font-mono)",fontSize:8,color:BAR[w.sentiment_label]||C.muted}}>{w.sentiment_label.toUpperCase()}</span>}
                      </div>
                      {w.last_quarter&&<span style={{fontFamily:"var(--font-mono)",fontSize:8,color:C.muted}}>Last: {w.last_quarter}</span>}
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setTicker(w.ticker);setSidePanel(null);}} style={{background:"none",border:"none",cursor:"pointer"}}><ExternalLink size={12} color={C.muted}/></button>
                      <button onClick={async()=>{await removeFromWatchlist(w.ticker);loadWatchlist();}} style={{background:"none",border:"none",cursor:"pointer"}}><X size={12} color={C.muted}/></button>
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
        position:"relative",zIndex:1,
        minHeight:"100vh",padding:"116px 52px 80px",
        display:"flex",alignItems:"center",
        paddingRight:"460px",
      }}>
        <motion.div
          variants={staggerContainer} initial="hidden" animate="show"
          style={{maxWidth:580,width:"100%",display:"flex",flexDirection:"column",gap:20}}
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUpVariant} transition={{duration:0.55}} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 14px",border:`1px solid rgba(0,200,150,0.18)`,borderRadius:4,width:"fit-content",background:"rgba(0,200,150,0.035)"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:C.accentHi,display:"inline-block",animation:"pulse 2.5s infinite"}}/>
            <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.28em",color:"rgba(0,200,150,0.55)",textTransform:"uppercase"}}>
              SEC EDGAR · FINBERT · GROQ AI · FAISS RAG
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUpVariant} transition={{duration:0.6}}
            style={{fontFamily:"var(--font-display)",fontSize:"clamp(64px,8vw,112px)",lineHeight:0.86,fontWeight:800,letterSpacing:"0.01em",color:C.text,margin:0}}
          >
            AUTOMATED<br/>
            <span style={{
              background:`linear-gradient(135deg, ${C.accentHi} 0%, ${C.accent} 60%, rgba(0,200,150,0.7) 100%)`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
            }}>EQUITY</span><br/>
            RESEARCH
          </motion.h1>

          {/* Rule */}
          <motion.div variants={fadeUpVariant} transition={{duration:0.4}} className="rule" style={{width:72,opacity:0.7}}/>

          {/* Sub-copy */}
          <motion.p variants={fadeUpVariant} transition={{duration:0.55}} style={{fontFamily:"var(--font-sans)",fontWeight:300,fontSize:13.5,lineHeight:1.95,maxWidth:420,color:"rgba(150,170,186,0.62)",margin:0}}>
            Ingest 10-K / 10-Q filings from SEC EDGAR. Score sentiment with FinBERT,
            detect Q-over-Q risk changes, extract financial metrics, and get
            Groq AI analyst answers — fully free, zero paid APIs.
          </motion.p>

          {/* ── Form ── */}
          <motion.div variants={fadeUpVariant} transition={{duration:0.55}} style={{
            ...panel,padding:24,
            borderLeft:`2px solid ${C.accent}`,
            borderRadius:"0 10px 10px 0",
            boxShadow:"0 8px 40px rgba(0,0,0,0.45)",
            position:"relative",overflow:"hidden",
          }}>
            {/* Scan beam on focus */}
            {inputFocused&&(
              <div style={{
                position:"absolute",top:0,left:0,right:0,height:1,
                background:`linear-gradient(90deg,transparent,${C.accentHi},transparent)`,
                animation:"scanBeam 1.8s ease-in-out infinite",
                zIndex:10,pointerEvents:"none",
              }}/>
            )}

            <div style={{display:"flex",gap:10,marginBottom:12}}>
              {/* Ticker input */}
              <div style={{flex:1}}>
                <label style={{...label,marginBottom:6,display:"flex",alignItems:"center",gap:5}}>
                  Stock Ticker
                  <span title="E.g. AAPL, MSFT, NVDA, JPM, TSLA" style={{cursor:"help",color:C.border,fontSize:11}}>ⓘ</span>
                </label>
                <div style={{display:"flex",gap:6}}>
                  <input
                    value={ticker}
                    onChange={e=>setTicker(e.target.value.toUpperCase())}
                    onKeyDown={e=>e.key==="Enter"&&analyze()}
                    onFocus={()=>setInputFocused(true)}
                    onBlur={()=>setInputFocused(false)}
                    placeholder="AAPL · MSFT · NVDA"
                    className="input-terminal"
                    style={{
                      flex:1,background:"rgba(0,0,0,0.6)",
                      border:`1px solid ${C.border}`,borderRadius:7,
                      padding:"10px 14px",fontFamily:"var(--font-mono)",
                      fontSize:14,color:C.text,letterSpacing:"0.08em",
                      transition:"border-color 0.18s,box-shadow 0.18s",
                    }}
                  />
                  {ticker&&(
                    <button onClick={toggleWatchlist} title={inWatchlist?"Remove from watchlist":"Add to watchlist"} style={{
                      background:inWatchlist?"rgba(0,200,150,0.10)":"transparent",
                      border:`1px solid ${inWatchlist?C.borderHi:C.border}`,
                      borderRadius:7,padding:"0 12px",cursor:"pointer",transition:"all 0.16s",
                    }}>
                      {inWatchlist?<Star size={13} color={C.accentHi} fill={C.accentHi}/>:<StarOff size={13} color={C.muted}/>}
                    </button>
                  )}
                </div>
              </div>
              {/* Quarter */}
              <div>
                <label style={{...label,marginBottom:6}}>Quarter</label>
                <select value={quarter} onChange={e=>setQuarter(e.target.value)} style={{
                  background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,
                  padding:"10px 10px",fontFamily:"var(--font-mono)",fontSize:11,
                  color:C.text,outline:"none",cursor:"pointer",
                }}>
                  {["Q1-2023","Q2-2023","Q3-2023","Q4-2023","Q1-2024","Q2-2024","Q3-2024","Q4-2024","Q1-2025","Q2-2025"].map(q=>(
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run button */}
            <motion.button
              whileHover={{scale:loading||!ticker.trim()?1:1.02}}
              whileTap={{scale:0.98}}
              onClick={analyze}
              disabled={loading||!ticker.trim()}
              style={{
                width:"100%",
                background:loading||!ticker.trim()?"rgba(0,200,150,0.03)":"rgba(0,200,150,0.10)",
                border:`1px solid ${loading||!ticker.trim()?C.border:C.borderHi}`,
                borderRadius:7,padding:"13px 0",
                fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:"0.22em",
                color:loading||!ticker.trim()?C.muted:C.accentHi,
                cursor:loading||!ticker.trim()?"not-allowed":"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                transition:"all 0.18s",
                boxShadow:loading||!ticker.trim()?"none":`0 0 20px rgba(0,200,150,0.08)`,
              }}
            >
              {loading?<><span className="loader"/> FETCHING FROM SEC EDGAR…</>:<><Search size={12}/> RUN ANALYSIS</>}
            </motion.button>

            {err&&<p style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.neg,marginTop:8,letterSpacing:"0.08em"}}>✗ {err}</p>}

            {/* Quick select */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:13,flexWrap:"wrap"}}>
              <ChevronRight size={9} color={C.muted}/>
              <span style={{fontFamily:"var(--font-mono)",fontSize:8,color:C.muted,letterSpacing:"0.14em"}}>QUICK SELECT</span>
              {["AAPL","MSFT","NVDA","JPM","TSLA"].map(t=>(
                <button key={t} onClick={()=>setTicker(t)} style={{
                  fontFamily:"var(--font-mono)",fontSize:9,padding:"3px 9px",
                  border:`1px solid ${C.border}`,borderRadius:3,
                  background:"transparent",color:C.muted,cursor:"pointer",transition:"all 0.14s",
                }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.text;el.style.borderColor=C.borderHi;el.style.background="rgba(0,200,150,0.05)";}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.color=C.muted;el.style.borderColor=C.border;el.style.background="transparent";}}
                >{t}</button>
              ))}
              <div style={{width:1,height:14,background:C.border,margin:"0 2px"}}/>
              <button onClick={loadDemo} style={{
                fontFamily:"var(--font-mono)",fontSize:9,padding:"3px 12px",
                border:`1px solid rgba(0,232,170,0.38)`,
                borderRadius:3,background:"rgba(0,232,170,0.07)",
                color:C.accentHi,cursor:"pointer",letterSpacing:"0.08em",transition:"all 0.14s",
              }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,232,170,0.13)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,232,170,0.07)"}
              >⚡ DEMO</button>
            </div>
          </motion.div>

          {/* Summary chips */}
          <AnimatePresence>
            {result&&resultsReady&&(
              <motion.div
                initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                exit={{opacity:0,y:10}} transition={{duration:0.35}}
                style={{display:"flex",gap:8}}
              >
                {[
                  {k:"SENTIMENT",v:result.sentiment.label.toUpperCase(),c:BAR[result.sentiment.label]||C.accentHi},
                  {k:"GUIDANCE", v:`${result.guidance.length} SIGNALS`,  c:C.neu},
                  {k:"RISK Δ",   v:`+${result.risk_delta.added.length} / −${result.risk_delta.removed.length}`,c:C.pos},
                ].map(m=>(
                  <TiltCard key={m.k} style={{...panel,flex:1,padding:"13px 14px"}}>
                    <div style={{...label,marginBottom:5}}>{m.k}</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:13,color:m.c,fontWeight:700,letterSpacing:"0.04em"}}>{m.v}</div>
                  </TiltCard>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ══ RESULTS / LOADER SECTION ══ */}
      <AnimatePresence>
        {(loading||result)&&(
          <motion.section
            ref={resultsRef}
            initial={{opacity:0,y:40}}
            animate={{opacity:1,y:0}}
            transition={{duration:0.45,ease:"easeOut"}}
            className="watermark-diag"
            style={{
              position:"relative",zIndex:1,
              background:"rgba(3,5,7,0.99)",
              borderTop:`1px solid ${C.border}`,
              minHeight:"100vh",paddingBottom:120,
            }}
          >
            {/* Loading state */}
            {loading&&(
              <div style={{display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"72px 52px"}}>
                <AnalysisLoader ticker={ticker} quarter={quarter}/>
              </div>
            )}

            {/* Results */}
            {!loading&&result&&(
              <>
                {/* Results header */}
                <div style={{padding:"28px 52px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:C.accentHi,display:"inline-block",animation:"pulse 2.5s infinite"}}/>
                    <span style={{fontFamily:"var(--font-display)",fontSize:14,letterSpacing:"0.16em",color:C.text,fontWeight:700}}>{result.ticker}</span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.16em",color:C.muted}}>· {result.quarter} · ANALYSIS REPORT</span>
                    {sentTrend==="up"  &&<TrendingUp   size={14} color={C.pos}/>}
                    {sentTrend==="down"&&<TrendingDown size={14} color={C.neg}/>}
                    {sentTrend==="flat"&&<Minus        size={14} color={C.neu}/>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:8,color:C.muted}}>{new Date(result.generated_at).toLocaleString()}</span>
                    <button onClick={analyze} style={{display:"flex",alignItems:"center",gap:5,fontFamily:"var(--font-mono)",fontSize:8,color:C.muted,background:"none",border:`1px solid ${C.border}`,borderRadius:4,padding:"4px 10px",cursor:"pointer",transition:"all 0.16s"}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=C.accentHi}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=C.muted}
                    ><RefreshCw size={10}/> REFRESH</button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{display:"flex",gap:0,padding:"14px 52px 0",borderBottom:`1px solid ${C.border}`}}>
                  {(["overview","risk","guidance","financials","market"] as const).map(tab=>(
                    <button
                      key={tab}
                      onClick={()=>setActiveTab(tab)}
                      className={`tab-btn ${activeTab===tab?"active":""}`}
                      style={{
                        fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.16em",
                        textTransform:"uppercase",padding:"10px 22px",
                        color:activeTab===tab?C.accentHi:C.muted,
                        background:"none",border:"none",cursor:"pointer",
                      }}
                    >{tab}</button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{padding:"28px 52px"}}>

                  {/* ── OVERVIEW ── */}
                  {activeTab==="overview"&&(
                    <motion.div
                      initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.3}}
                      style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1040}}
                    >
                      {/* Sentiment */}
                      <TiltCard style={{...panel,padding:26,borderTop:`2px solid ${BAR[result.sentiment.label]||C.accentHi}`}}>
                        <p style={label}>FINBERT NLP SENTIMENT</p>
                        {(["positive","negative","neutral"] as const).map((k,i)=>(
                          <SentimentBar
                            key={k} label={k}
                            value={result.sentiment.score[k]}
                            color={BAR[k]}
                            delay={i*0.15}
                            trigger={resultsReady}
                          />
                        ))}
                        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{...label,marginBottom:0}}>VERDICT</span>
                          <span style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:800,color:BAR[result.sentiment.label]||C.accentHi,letterSpacing:"0.1em"}}>
                            {result.sentiment.label.toUpperCase()}
                          </span>
                        </div>
                      </TiltCard>

                      {/* Analyst brief — typewriter */}
                      <TiltCard style={{...panel,padding:26,borderTop:`2px solid ${C.accentHi}`}}>
                        <p style={label}>ANALYST BRIEF</p>
                        <p style={{fontFamily:"var(--font-sans)",fontSize:12.5,lineHeight:1.95,color:"rgba(150,170,186,0.72)",margin:0,minHeight:120}}>
                          {briefText}
                          {briefText.length<(result.brief||"").length&&(
                            <span style={{display:"inline-block",width:2,height:"1em",background:C.accentHi,marginLeft:2,animation:"pulse 0.7s infinite",verticalAlign:"middle"}}/>
                          )}
                        </p>
                        <button style={{marginTop:14,fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:"0.16em",color:C.accentHi,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:0.65}}>
                          <FileText size={10}/> EXPORT PDF REPORT
                        </button>
                      </TiltCard>

                      {/* Risk snapshot */}
                      <TiltCard style={{...panel,padding:26}}>
                        <p style={label}>RISK SNAPSHOT</p>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                          <StatCount n={result.risk_delta.added.length}    label="Added"    color={C.neg} trigger={resultsReady}/>
                          <StatCount n={result.risk_delta.removed.length}  label="Removed"  color={C.pos} trigger={resultsReady}/>
                          <StatCount n={result.risk_delta.modified.length} label="Modified" color={C.neu} trigger={resultsReady}/>
                        </div>
                      </TiltCard>

                      {/* Guidance breakdown */}
                      <TiltCard style={{...panel,padding:26}}>
                        <p style={label}>GUIDANCE BREAKDOWN</p>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                          <StatCount n={result.guidance.filter(g=>g.tag==="optimistic").length} label="Optimistic" color={C.pos} trigger={resultsReady}/>
                          <StatCount n={result.guidance.filter(g=>g.tag==="cautious").length}   label="Cautious"   color={C.neg} trigger={resultsReady}/>
                          <StatCount n={result.guidance.filter(g=>g.tag==="neutral").length}    label="Neutral"    color={C.neu} trigger={resultsReady}/>
                        </div>
                      </TiltCard>
                    </motion.div>
                  )}

                  {/* ── RISK ── */}
                  {activeTab==="risk"&&(
                    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.3}} style={{maxWidth:920}}>
                      <TiltCard style={{...panel,padding:26,marginBottom:16,borderLeft:`3px solid ${C.neg}`}}>
                        <p style={label}>NEW RISK FACTORS — {result.risk_delta.added.length} ADDED</p>
                        {result.risk_delta.added.length===0
                          ?<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11}}>No new risk factors vs prior quarter.</p>
                          :result.risk_delta.added.map((s,i)=>(
                            <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}} style={{display:"flex",gap:12,marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                              <span style={{color:C.neg,fontFamily:"var(--font-mono)",fontSize:14,flexShrink:0,fontWeight:700}}>+</span>
                              <p style={{fontFamily:"var(--font-sans)",fontSize:13,lineHeight:1.75,color:"rgba(150,170,186,0.72)",margin:0}}>{s}</p>
                            </motion.div>
                          ))
                        }
                      </TiltCard>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                        <TiltCard style={{...panel,padding:26,borderLeft:`3px solid ${C.pos}`}}>
                          <p style={label}>REMOVED — {result.risk_delta.removed.length}</p>
                          {result.risk_delta.removed.length===0
                            ?<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11}}>None removed.</p>
                            :result.risk_delta.removed.slice(0,5).map((s,i)=>(
                              <div key={i} style={{display:"flex",gap:8,marginBottom:10}}>
                                <span style={{color:C.pos,fontFamily:"var(--font-mono)",fontSize:12,flexShrink:0,fontWeight:700}}>−</span>
                                <p style={{fontFamily:"var(--font-sans)",fontSize:11.5,lineHeight:1.65,color:C.muted,margin:0}}>{s.slice(0,150)}{s.length>150?"…":""}</p>
                              </div>
                            ))
                          }
                        </TiltCard>
                        <TiltCard style={{...panel,padding:26,borderLeft:`3px solid ${C.neu}`}}>
                          <p style={label}>MODIFIED — {result.risk_delta.modified.length}</p>
                          {result.risk_delta.modified.length===0
                            ?<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11}}>None modified.</p>
                            :result.risk_delta.modified.slice(0,3).map(([o,n],i)=>(
                              <div key={i} style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                                <p style={{fontFamily:"var(--font-sans)",fontSize:10.5,color:C.neg,marginBottom:5}}>BEFORE: {o.slice(0,90)}…</p>
                                <p style={{fontFamily:"var(--font-sans)",fontSize:10.5,color:C.pos,margin:0}}>AFTER: {n.slice(0,90)}…</p>
                              </div>
                            ))
                          }
                        </TiltCard>
                      </div>
                    </motion.div>
                  )}

                  {/* ── GUIDANCE ── */}
                  {activeTab==="guidance"&&(
                    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.3}} style={{maxWidth:800}}>
                      <TiltCard style={{...panel,padding:26}}>
                        <p style={label}>FORWARD GUIDANCE — {result.guidance.length} SIGNALS</p>
                        {result.guidance.length===0
                          ?<p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:11}}>No forward guidance signals detected in MD&A.</p>
                          :(
                            <div style={{display:"flex",flexDirection:"column",gap:0}}>
                              {result.guidance.map((g,i)=>(
                                <motion.div
                                  key={i}
                                  initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.07,duration:0.3}}
                                  style={{display:"flex",gap:14,alignItems:"flex-start",padding:"15px 0",borderBottom:`1px solid ${C.border}`}}
                                >
                                  <span style={{fontFamily:"var(--font-mono)",fontSize:7,padding:"3px 9px",borderRadius:3,flexShrink:0,letterSpacing:"0.14em",marginTop:2,...TAG_S[g.tag]}}>
                                    {g.tag.toUpperCase()}
                                  </span>
                                  <p style={{fontFamily:"var(--font-sans)",fontSize:13,lineHeight:1.75,color:"rgba(150,170,186,0.72)",margin:0}}>{g.text}</p>
                                </motion.div>
                              ))}
                            </div>
                          )
                        }
                      </TiltCard>
                    </motion.div>
                  )}

                  {/* ── FINANCIALS ── */}
                  {activeTab==="financials"&&(
                    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.3}} style={{maxWidth:940}}>
                      {!result.financials?.available
                        ?(
                          <TiltCard style={{...panel,padding:32,textAlign:"center"}}>
                            <p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:12}}>Financial table data could not be extracted from this filing.</p>
                          </TiltCard>
                        )
                        :(
                          <>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
                              {[
                                {k:"Revenue",       v:result.financials.revenue,          c:C.accentHi},
                                {k:"Net Income",    v:result.financials.net_income,       c:C.pos},
                                {k:"Gross Profit",  v:result.financials.gross_profit,     c:C.pos},
                                {k:"Operating Inc.",v:result.financials.operating_income, c:C.accentHi},
                                {k:"EPS Diluted",   v:result.financials.eps_diluted?`$${result.financials.eps_diluted}`:undefined,c:C.accentHi},
                                {k:"EPS Basic",     v:result.financials.eps_basic?`$${result.financials.eps_basic}`:undefined,c:C.accentHi},
                              ].filter(m=>m.v).map((m,i)=>(
                                <TiltCard key={m.k} style={{...panel,padding:"22px 22px",borderTop:`2px solid ${m.c}`}}>
                                  <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}>
                                    <p style={{...label,marginBottom:10}}>{m.k}</p>
                                    <p style={{fontFamily:"var(--font-display)",fontSize:26,color:m.c,fontWeight:800,margin:0}}>{m.v}</p>
                                  </motion.div>
                                </TiltCard>
                              ))}
                            </div>

                            {(result.financials.gross_margin||result.financials.operating_margin||result.financials.net_margin)&&(
                              <TiltCard style={{...panel,padding:26}}>
                                <p style={label}>MARGIN ANALYSIS</p>
                                {[
                                  {l:"Gross Margin",     v:result.financials.gross_margin},
                                  {l:"Operating Margin", v:result.financials.operating_margin},
                                  {l:"Net Margin",       v:result.financials.net_margin},
                                ].filter(m=>m.v).map((m,i)=>{
                                  const pct=parseFloat(m.v!.replace("%",""));
                                  const col=pct>30?C.pos:pct>15?C.accentHi:C.neu;
                                  return(
                                    <div key={m.l} style={{marginBottom:20}}>
                                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                                        <span style={{fontFamily:"var(--font-sans)",fontSize:12,color:C.text2}}>{m.l}</span>
                                        <span style={{fontFamily:"var(--font-mono)",fontSize:14,color:col,fontWeight:700}}>{m.v}</span>
                                      </div>
                                      <div style={{height:4,background:"rgba(0,150,100,0.07)",borderRadius:2,overflow:"hidden"}}>
                                        <motion.div
                                          initial={{width:0}} animate={{width:`${Math.min(pct,100)}%`}}
                                          transition={{duration:1.4,ease:"easeOut",delay:i*0.18}}
                                          style={{height:"100%",borderRadius:2,background:`linear-gradient(90deg,${col},${col}cc)`,position:"relative"}}
                                        >
                                          <div style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",width:5,height:5,borderRadius:"50%",background:col,boxShadow:`0 0 8px ${col}`}}/>
                                        </motion.div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </TiltCard>
                            )}
                          </>
                        )
                      }
                    </motion.div>
                  )}

                  {/* ── MARKET ── */}
                  {activeTab==="market"&&(
                    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:0.3}} style={{maxWidth:820}}>
                      {!result.market?.price
                        ?<TiltCard style={{...panel,padding:24}}><p style={{fontFamily:"var(--font-sans)",color:C.muted,fontSize:12}}>Live market data unavailable.</p></TiltCard>
                        :(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                            {[
                              {k:"PRICE",     v:`$${result.market.price?.toFixed(2)}`,      c:C.text,    b:C.accentHi},
                              {k:"P/E RATIO", v:result.market.pe_ratio?.toFixed(1)??"—",    c:C.accentHi,b:C.accentHi},
                              {k:"MARKET CAP",v:fmtMarketCap(result.market.market_cap),      c:C.accentHi,b:C.accentHi},
                              {k:"52W HIGH",  v:`$${result.market["52w_high"]?.toFixed(2)}`, c:C.pos,     b:C.pos},
                              {k:"52W LOW",   v:`$${result.market["52w_low"]?.toFixed(2)}`,  c:C.neg,     b:C.neg},
                              {k:"TICKER",    v:result.market.ticker,                          c:C.text,    b:C.border},
                            ].map((m,i)=>(
                              <TiltCard key={m.k} style={{...panel,padding:"22px 22px",borderTop:`2px solid ${m.b}`}}>
                                <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}>
                                  <p style={{...label,marginBottom:10}}>{m.k}</p>
                                  <p style={{fontFamily:"var(--font-display)",fontSize:24,color:m.c,fontWeight:800,margin:0}}>{m.v}</p>
                                </motion.div>
                              </TiltCard>
                            ))}
                          </div>
                        )
                      }
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ══ CHAT PANEL ══ */}
      <AnimatePresence>
        {chatOpen&&(
          <motion.div
            initial={{opacity:0,x:24,scale:0.96}}
            animate={{opacity:1,x:0,scale:1}}
            exit={{opacity:0,x:24,scale:0.96}}
            transition={{duration:0.3,ease:"easeOut"}}
            style={{
              position:"fixed",bottom:32,right:460,zIndex:55,
              width:316,height:436,
              background:"rgba(4,6,10,0.99)",
              border:`1px solid ${C.borderHi}`,
              borderRadius:12,overflow:"hidden",
              backdropFilter:"blur(36px)",
              boxShadow:"0 24px 72px rgba(0,0,0,0.8),0 0 0 1px rgba(0,200,150,0.07),0 0 40px rgba(0,200,150,0.05)",
              display:"flex",flexDirection:"column",
            }}
          >
            {/* Chat header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:`1px solid ${C.border}`,background:"rgba(0,0,0,0.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Brain size={12} color={C.accentHi}/>
                <span style={{fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.20em",color:C.accentHi}}>FINSIGHT AI</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:7,color:C.muted,letterSpacing:"0.1em"}}>· GROQ LLAMA-3</span>
              </div>
              <button onClick={()=>setChatOpen(false)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={13} color={C.muted}/></button>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
              {msgs.map((m,i)=>(
                <motion.div key={i} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:0.05}} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{
                    maxWidth:"88%",borderRadius:8,padding:"9px 13px",
                    fontSize:12,lineHeight:1.65,fontFamily:"var(--font-sans)",
                    ...(m.role==="user"
                      ?{background:"rgba(0,200,150,0.10)",border:`1px solid rgba(0,200,150,0.20)`,color:C.text}
                      :{background:"rgba(0,0,0,0.6)",border:`1px solid ${C.border}`,color:"rgba(150,170,186,0.80)"}
                    ),
                  }}>{m.content}</div>
                </motion.div>
              ))}
              {chatLoading&&(
                <div style={{display:"flex"}}>
                  <div style={{background:"rgba(0,0,0,0.6)",border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 15px"}}>
                    <span className="loader" style={{width:11,height:11,borderWidth:2}}/>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,background:"rgba(0,0,0,0.35)"}}>
              <input
                value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendChat()}
                placeholder="Ask about the filing…"
                className="input-terminal"
                style={{flex:1,background:"rgba(0,0,0,0.65)",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 13px",fontFamily:"var(--font-sans)",fontSize:12,color:C.text}}
              />
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} style={{
                background:"rgba(0,200,150,0.10)",border:`1px solid ${C.borderHi}`,
                borderRadius:7,padding:"0 13px",cursor:"pointer",
                opacity:chatLoading||!chatInput.trim()?0.3:1,
                display:"flex",alignItems:"center",transition:"opacity 0.14s",
              }}>
                <Send size={13} color={C.accentHi}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ROBOT ══ */}
      <div
        onClick={()=>setChatOpen(v=>!v)}
        title={chatOpen?"Close analyst":"Ask FinSight AI (Groq)"}
        style={{position:"fixed",bottom:-30,right:-20,zIndex:50,width:480,height:520,cursor:"pointer",background:"transparent",overflow:"visible"}}
      >
        <div style={{position:"absolute",top:"40%",left:"48%",transform:"translate(-50%,-50%)",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,200,150,0.09) 0%,transparent 70%)",filter:"blur(44px)",pointerEvents:"none"}}/>
        <motion.div
          initial={{opacity:0,scale:0.85}} animate={{opacity:1,scale:1}} transition={{delay:0.7,type:"spring",stiffness:200}}
          style={{
            position:"absolute",top:52,left:16,zIndex:1,
            background:"rgba(4,6,10,0.97)",border:`1px solid ${chatOpen?C.borderHi:C.border}`,
            borderRadius:20,padding:"6px 15px",
            fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:"0.14em",color:C.accentHi,
            display:"flex",alignItems:"center",gap:7,pointerEvents:"none",
            boxShadow:"0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          <span style={{width:5,height:5,borderRadius:"50%",background:C.accentHi,display:"inline-block",animation:"pulse 2.5s infinite"}}/>
          {chatOpen?"CHAT OPEN · GROQ AI":"ANALYST READY · CLICK TO CHAT"}
        </motion.div>
        <SplineScene className="w-full h-full"/>
      </div>

      {/* ══ CIRCULAR NAV ══ */}
      <div style={{position:"fixed",bottom:30,left:"50%",transform:"translateX(-50%)",zIndex:48}}>
        {[
          {icon:Home,         label:"OVERVIEW", id:"home",     a:270,r:90},
          {icon:BarChart2,    label:"ANALYSIS", id:"analysis", a:234,r:90},
          {icon:Shield,       label:"RISK",     id:"risk",     a:306,r:90},
          {icon:Database,     label:"RESEARCH", id:"research", a:198,r:90},
          {icon:MessageCircle,label:"CHAT",     id:"chat",     a:342,r:90},
        ].map((item,i)=>{
          const rad=(item.a*Math.PI)/180;
          const x=Math.cos(rad)*item.r, y=Math.sin(rad)*item.r;
          const Icon=item.icon;
          return(
            <div key={item.id} style={{
              position:"absolute",left:"50%",bottom:"50%",
              transform:navOpen?`translate(calc(-50% + ${x}px),calc(50% + ${y}px))`:"translate(-50%,50%)",
              opacity:navOpen?1:0,pointerEvents:navOpen?"auto":"none",
              transition:`transform 0.44s cubic-bezier(0.34,1.56,0.64,1) ${i*40}ms,opacity 0.22s ease ${i*28}ms`,
              zIndex:49,
            }}>
              <div style={{position:"absolute",bottom:"calc(100% + 7px)",left:"50%",transform:"translateX(-50%)",background:"rgba(4,6,10,0.98)",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 9px",fontFamily:"var(--font-mono)",fontSize:7,letterSpacing:"0.14em",color:C.accentHi,whiteSpace:"nowrap",pointerEvents:"none",opacity:navOpen?1:0,transition:`opacity 0.18s ease ${i*40+120}ms`}}>
                {item.label}
              </div>
              <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(4,6,10,0.96)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(16px)",transition:"all 0.2s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.borderHi;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.border;}}
              >
                <Icon size={14} color="rgba(0,200,150,0.44)"/>
              </div>
            </div>
          );
        })}
        <div
          onClick={()=>setNavOpen(v=>!v)}
          style={{
            position:"relative",zIndex:50,width:50,height:50,borderRadius:"50%",
            background:navOpen?"rgba(0,200,150,0.12)":"rgba(4,6,10,0.96)",
            border:`1px solid ${navOpen?C.borderHi:C.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            cursor:"pointer",backdropFilter:"blur(20px)",
            boxShadow:"0 4px 24px rgba(0,0,0,0.55)",transition:"all 0.26s",
          }}
        >
          {navOpen?<X size={16} color={C.accentHi}/>:<Menu size={16} color="rgba(0,200,150,0.5)"/>}
        </div>
      </div>

    </div>
  );
}
