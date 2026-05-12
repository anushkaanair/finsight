import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FinSight — Equity Research Intelligence",
  description:
    "Automated SEC filing analyst. FinBERT sentiment · Q-over-Q risk deltas · RAG chat. Zero cost, fully local.",
  keywords: ["finbert", "SEC", "EDGAR", "earnings", "equity research", "10-Q", "10-K"],
  openGraph: {
    title: "FinSight — Equity Research Intelligence",
    description: "AI-powered SEC filing analysis with FinBERT, FAISS RAG, and flan-t5-base chat.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${mono.variable} ${sans.variable}`}>
      <body className="bg-[#05080A] text-[#C4D4DC] min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
