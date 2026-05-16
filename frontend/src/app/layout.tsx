import type { Metadata } from "next";
import { Syne, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Syne — geometric display, futuristic fintech feel */
const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});

/* IBM Plex Sans — precision typeface, finance / data platforms */
const ibm = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});

/* JetBrains Mono — data / numbers / labels */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FinSight — Equity Research Intelligence",
  description:
    "Automated SEC filing analyst. FinBERT sentiment · Q-over-Q risk deltas · Groq AI RAG chat. Zero cost, fully local.",
  keywords: ["finbert", "SEC", "EDGAR", "earnings", "equity research", "10-Q", "10-K", "groq", "llm"],
  openGraph: {
    title: "FinSight — Equity Research Intelligence",
    description: "AI-powered SEC filing analysis with FinBERT, FAISS RAG, and Groq Llama-3 chat.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${ibm.variable} ${mono.variable}`}>
      <body className="bg-[#05080A] text-[#C4D4DC] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
