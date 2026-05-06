import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinSight — Earnings Intelligence",
  description: "Automated SEC filing analyst powered by FinBERT and RAG. Zero cost, fully local.",
  keywords: ["finbert", "SEC", "EDGAR", "earnings", "equity research", "10-Q", "10-K"],
  openGraph: {
    title: "FinSight — Earnings Intelligence",
    description: "AI-powered SEC filing analysis with FinBERT sentiment, risk deltas, and RAG chat.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#060a06] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
