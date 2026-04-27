'use client'

import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Spotlight } from '@/components/ui/spotlight'
import { Chatbot } from '@/components/ui/chatbot'
import { fetchMarketData } from '@/lib/api'
import type { Brief, MarketSnapshot } from '@/types/brief'

const TREND_ICON = {
  up: <TrendingUp size={16} className="text-green-400" />,
  down: <TrendingDown size={16} className="text-red-400" />,
  flat: <Minus size={16} className="text-yellow-400" />,
}

const LABEL_COLOR = {
  positive: "text-green-400",
  negative: "text-red-400",
  neutral: "text-yellow-400",
}

const TAG_BG = {
  optimistic: "bg-green-900/40 text-green-300 border border-green-700",
  cautious: "bg-red-900/40 text-red-300 border border-red-700",
  neutral: "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
}

export default function Home() {
  const [ticker, setTicker] = useState("")
  const [quarter, setQuarter] = useState("Q3-2024")
  const [priorQuarter, setPriorQuarter] = useState("Q2-2024")
  const [brief, setBrief] = useState<Brief | null>(null)
  const [market, setMarket] = useState<MarketSnapshot | null>(null)
  const [status, setStatus] = useState("")

  const briefContext = brief
    ? `Ticker: ${brief.ticker}, Quarter: ${brief.quarter}. Sentiment: ${brief.sentiment.label}. ` +
      brief.guidance.map((g) => g.text).join(" ")
    : ""

  async function handleAnalyze() {
    if (!ticker) return
    setStatus("Fetching market data...")

    try {
      const mkt = await fetchMarketData(ticker)
      setMarket(mkt)
    } catch {
      // market data is best-effort
    }

    setStatus("Running analysis... (first run may take a few minutes)")

    // Demo brief — replaced by real data after running finsight_cli.py
    setBrief({
      ticker: ticker.toUpperCase(),
      quarter,
      generated_at: new Date().toISOString(),
      sentiment: {
        score: { positive: 0.62, negative: 0.18, neutral: 0.20 },
        label: "positive",
        trend: "up",
      },
      guidance: [
        {
          text: "We expect continued growth in our Services segment going forward.",
          tag: "optimistic",
          offset: 0,
        },
        {
          text: "We anticipate headwinds from foreign exchange rates in the coming quarter.",
          tag: "cautious",
          offset: 0,
        },
      ],
      risk_delta: {
        added: ["Geopolitical tensions may disrupt global supply chain operations."],
        removed: ["Third-party manufacturer dependency risk."],
        modified: [
          [
            "Competition is intense.",
            "Competition continues to accelerate across all markets.",
          ],
        ],
      },
      rag_results: {
        [quarter]: [
          {
            text: "Revenue increased 6% year-over-year driven by strong Services performance.",
            score: 0.12,
          },
        ],
        [priorQuarter]: [
          {
            text: "Revenue grew modestly with iPhone sales in line with expectations.",
            score: 0.18,
          },
        ],
      },
    })

    setStatus("")
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            FinSight
          </h1>
          <p className="mt-2 text-neutral-400">Automated SEC Filing Intelligence</p>
        </div>

        <Card className="bg-neutral-900/60 border-neutral-700 mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <input
                className="flex-1 min-w-40 bg-neutral-800 border border-neutral-600 text-white rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 placeholder:text-neutral-500"
                placeholder="Ticker (e.g. AAPL)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
              <input
                className="w-32 bg-neutral-800 border border-neutral-600 text-white rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Q3-2024"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
              />
              <input
                className="w-32 bg-neutral-800 border border-neutral-600 text-white rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Q2-2024"
                value={priorQuarter}
                onChange={(e) => setPriorQuarter(e.target.value)}
              />
              <button
                onClick={handleAnalyze}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Search size={14} />
                Analyze
              </button>
            </div>
            {status && <p className="mt-3 text-xs text-neutral-400">{status}</p>}
          </CardContent>
        </Card>

        {market && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Price", value: market.price ? `$${market.price.toFixed(2)}` : "—" },
              { label: "P/E", value: market.pe_ratio?.toFixed(1) ?? "—" },
              {
                label: "Market Cap",
                value: market.market_cap
                  ? `$${(market.market_cap / 1e12).toFixed(2)}T`
                  : "—",
              },
              {
                label: "52W High",
                value: market["52w_high"] ? `$${market["52w_high"]}` : "—",
              },
              {
                label: "52W Low",
                value: market["52w_low"] ? `$${market["52w_low"]}` : "—",
              },
            ].map((item) => (
              <Card key={item.label} className="bg-neutral-900/60 border-neutral-700">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-neutral-400">{item.label}</p>
                  <p className="text-lg font-semibold text-white">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {brief && (
          <div className="space-y-4">
            <Card className="bg-neutral-900/60 border-neutral-700">
              <CardHeader>
                <CardTitle className="text-base text-neutral-200">Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-2xl font-bold ${LABEL_COLOR[brief.sentiment.label]}`}
                  >
                    {brief.sentiment.label.toUpperCase()}
                  </span>
                  {brief.sentiment.trend && TREND_ICON[brief.sentiment.trend]}
                </div>
                <div className="mt-2 flex gap-4 text-sm text-neutral-400">
                  <span>
                    Positive: {(brief.sentiment.score.positive * 100).toFixed(0)}%
                  </span>
                  <span>
                    Negative: {(brief.sentiment.score.negative * 100).toFixed(0)}%
                  </span>
                  <span>
                    Neutral: {(brief.sentiment.score.neutral * 100).toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-700">
              <CardHeader>
                <CardTitle className="text-base text-neutral-200">
                  Forward Guidance Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {brief.guidance.map((g, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 text-sm ${TAG_BG[g.tag]}`}
                    >
                      <span className="font-mono text-xs mr-2">
                        [{g.tag.toUpperCase()}]
                      </span>
                      {g.text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-700">
              <CardHeader>
                <CardTitle className="text-base text-neutral-200">
                  Risk Factor Changes vs {priorQuarter}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {brief.risk_delta.added.map((r, i) => (
                    <p key={i} className="text-green-400">
                      <span className="font-mono mr-2">+</span>
                      {r}
                    </p>
                  ))}
                  {brief.risk_delta.removed.map((r, i) => (
                    <p key={i} className="text-red-400">
                      <span className="font-mono mr-2">−</span>
                      {r}
                    </p>
                  ))}
                  {brief.risk_delta.modified.map(([old, nw], i) => (
                    <div key={i} className="text-yellow-400">
                      <p>
                        <span className="font-mono mr-2">~</span>
                        {old}
                      </p>
                      <p className="ml-4 text-neutral-300">→ {nw}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-700">
              <CardHeader>
                <CardTitle className="text-base text-neutral-200">
                  Q-over-Q Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(brief.rag_results).map(([q, chunks]) => (
                    <div key={q}>
                      <p className="text-xs font-mono text-blue-400 mb-1">{q}</p>
                      {chunks.slice(0, 2).map((c, i) => (
                        <p key={i} className="text-sm text-neutral-300 italic">
                          &ldquo;{c.text}&rdquo;
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Chatbot ticker={ticker} context={briefContext} />
    </main>
  )
}
