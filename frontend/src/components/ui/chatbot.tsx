'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SplineScene } from '@/components/ui/splite'
import { sendChatMessage } from '@/lib/api'
import type { ChatMessage } from '@/types/brief'
import { cn } from '@/lib/utils'

const SPLINE_ROBOT = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"

const TAG_COLOR: Record<string, string> = {
  optimistic: "text-green-400",
  cautious: "text-red-400",
  neutral: "text-yellow-400",
}

interface ChatbotProps {
  ticker?: string
  context?: string
}

export function Chatbot({ ticker = "", context = "" }: ChatbotProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hey! Ask me anything about the filing, the market, or general finance.",
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
    setMessages((prev) => [...prev, { role: "user", content: query }])
    setLoading(true)

    try {
      const res = await sendChatMessage(query, ticker, context)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Couldn't reach the backend. Is Flask running on port 5000?",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 h-96 bg-neutral-900 border border-neutral-700 rounded-xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-neutral-800">
              <span className="text-sm font-semibold text-white">FinSight AI</span>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-800 text-neutral-100 border border-neutral-700"
                    )}
                  >
                    <p>{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-neutral-600 space-y-1">
                        {msg.sources.slice(0, 2).map((s, j) => (
                          <p key={j} className="text-xs text-neutral-400 italic">
                            &ldquo;{s.text.slice(0, 80)}...&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2">
                    <span
                      className="loader"
                      style={{ width: 14, height: 14, borderWidth: 2 }}
                    />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 py-2 border-t border-neutral-700 flex gap-2">
              <input
                className="flex-1 bg-neutral-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-neutral-600 focus:border-blue-500 placeholder:text-neutral-500"
                placeholder="Ask about filings, market, finance..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg p-2"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="relative w-32 h-32 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        title="Chat with FinSight AI"
      >
        <SplineScene scene={SPLINE_ROBOT} className="w-full h-full" />
        {!open && (
          <div className="absolute -top-1 -right-1 bg-blue-600 rounded-full p-1">
            <MessageCircle size={12} className="text-white" />
          </div>
        )}
      </div>
    </div>
  )
}
