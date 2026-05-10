'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, MessageCircle, Brain } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendChatMessage } from '@/lib/api'
import type { ChatMessage } from '@/types/brief'
import { cn } from '@/lib/utils'

interface ChatbotProps {
  ticker?: string
  context?: string
}

export function Chatbot({ ticker = "", context = "" }: ChatbotProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me anything about a filing — sentiment, risk factors, guidance, or market data.",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  async function handleSend() {
    const query = input.trim()
    if (!query || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: query }])
    setLoading(true)
    try {
      const res = await sendChatMessage(query, ticker, context)
      setMessages(prev => [...prev, { role: "assistant", content: res.answer, sources: res.sources }])
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Cannot reach the backend. Make sure Flask is running on port 5000.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
    }}>
      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              width: 320, height: 420,
              background: "rgba(0, 14, 6, 0.96)",
              border: "1px solid rgba(0,200,100,0.2)",
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              backdropFilter: "blur(20px)",
              boxShadow: "0 0 40px rgba(0,200,100,0.06)",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(0,200,100,0.12)",
              background: "rgba(0,20,8,0.8)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={13} color="#00D68F" />
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  letterSpacing: "0.18em", color: "#00D68F",
                }}>FINSIGHT AI</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={14} color="rgba(0,200,100,0.5)" />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "86%",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    lineHeight: 1.55,
                    fontFamily: "var(--font-sans)",
                    ...(msg.role === "user"
                      ? {
                          background: "rgba(0,200,100,0.15)",
                          border: "1px solid rgba(0,200,100,0.25)",
                          color: "#C8DDD0",
                        }
                      : {
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(0,200,100,0.1)",
                          color: "rgba(180,220,195,0.75)",
                        }
                    ),
                  }}>
                    <p>{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,200,100,0.1)" }}>
                        {msg.sources.slice(0, 2).map((s, j) => (
                          <p key={j} style={{ fontSize: 10, color: "rgba(0,200,100,0.4)", fontStyle: "italic", marginTop: 2 }}>
                            "{s.text.slice(0, 72)}…"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(0,200,100,0.1)",
                    borderRadius: 8, padding: "10px 14px",
                  }}>
                    <span className="loader" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "10px 12px",
              borderTop: "1px solid rgba(0,200,100,0.1)",
              display: "flex", gap: 8,
            }}>
              <input
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(0,200,100,0.15)",
                  borderRadius: 7, padding: "8px 12px",
                  fontFamily: "var(--font-sans)", fontSize: 12,
                  color: "#C8DDD0", outline: "none",
                }}
                placeholder="Ask about the filing…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  background: "rgba(0,200,100,0.15)",
                  border: "1px solid rgba(0,200,100,0.3)",
                  borderRadius: 7, padding: "0 12px",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  opacity: loading || !input.trim() ? 0.4 : 1,
                  display: "flex", alignItems: "center",
                }}
              >
                <Send size={13} color="#00D68F" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toggle button — simple circle, NO robot ── */}
      <button
        onClick={() => setOpen(v => !v)}
        title="FinSight AI Chat"
        style={{
          width: 46, height: 46, borderRadius: "50%",
          background: open ? "rgba(0,200,100,0.2)" : "rgba(0,14,6,0.92)",
          border: `1px solid ${open ? "rgba(0,200,100,0.45)" : "rgba(0,200,100,0.22)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", backdropFilter: "blur(14px)",
          boxShadow: open ? "0 0 18px rgba(0,200,100,0.14)" : "none",
          transition: "all 0.25s ease",
        }}
      >
        {open
          ? <X size={16} color="#00D68F" />
          : <MessageCircle size={16} color="rgba(0,200,100,0.6)" />
        }
      </button>
    </div>
  )
}
