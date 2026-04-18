export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-black text-emerald-400">404</h1>
      <p className="text-emerald-200/60 text-sm">Page not found.</p>
      <a href="/" className="text-xs text-emerald-500 hover:text-emerald-300 transition-colors">
        ← Back to FinSight
      </a>
    </div>
  );
}
