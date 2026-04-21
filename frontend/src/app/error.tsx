"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-black text-red-400">Something went wrong</h1>
      <p className="text-emerald-200/50 text-sm max-w-sm text-center">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg border border-emerald-900 text-emerald-400 text-xs hover:bg-emerald-900/20 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
