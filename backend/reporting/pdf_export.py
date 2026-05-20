"""
PDF export for FinSight analysis results.
Generates a clean A4 analyst report from a full analysis dict.
"""
from __future__ import annotations

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors

TAG_COLOR_MAP = {
    "optimistic": colors.HexColor("#16a34a"),
    "cautious":   colors.HexColor("#dc2626"),
    "neutral":    colors.HexColor("#d97706"),
}
SECTION_COLOR = colors.HexColor("#1e3a5f")


def export_pdf(result: dict, output_path: str | None = None) -> str:
    """
    Generate a PDF analyst report from a full analysis result dict.
    Returns the output file path.
    """
    ticker  = result.get("ticker", "UNKNOWN")
    quarter = result.get("quarter", "")
    date    = (result.get("generated_at") or "")[:10]
    path    = output_path or f"{ticker}_{quarter}_finsight.pdf"

    c = pdf_canvas.Canvas(path, pagesize=A4)
    width, height = A4
    margin = 0.75 * inch
    y = height - margin

    # ── helpers ──────────────────────────────────────────────────────────
    def ensure_space(needed: float = 20):
        nonlocal y
        if y < margin + needed:
            c.showPage()
            y = height - margin

    def draw_text(text: str, size: int = 10, bold: bool = False,
                  color=colors.black, indent: float = 0, gap: int = 4):
        nonlocal y
        ensure_space(size + gap + 4)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.setFillColor(color)
        # Wrap long lines
        max_chars = int((width - 2 * margin - indent) / (size * 0.55))
        text = str(text)
        while text:
            c.drawString(margin + indent, y, text[:max_chars])
            text = text[max_chars:]
            y -= size + gap
            if text:
                ensure_space(size + gap)

    def draw_rule(color=colors.HexColor("#e5e7eb")):
        nonlocal y
        ensure_space(8)
        c.setStrokeColor(color)
        c.setLineWidth(0.5)
        c.line(margin, y, width - margin, y)
        y -= 8

    def draw_section(title: str):
        nonlocal y
        y -= 10
        ensure_space(20)
        draw_text(title, size=11, bold=True, color=SECTION_COLOR)
        draw_rule(SECTION_COLOR)

    # ── header ────────────────────────────────────────────────────────────
    c.setFillColor(SECTION_COLOR)
    c.rect(0, height - 60, width, 60, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, height - 38, "FinSight Analyst Report")
    c.setFont("Helvetica", 10)
    c.drawString(margin, height - 52, f"{ticker}  ·  {quarter}  ·  {date}")
    y = height - 80

    # ── health score ─────────────────────────────────────────────────────
    draw_section("Filing Health Score")
    score = result.get("health_score")
    if score is not None:
        score_color = (
            colors.HexColor("#16a34a") if score >= 65
            else colors.HexColor("#d97706") if score >= 45
            else colors.HexColor("#dc2626")
        )
        draw_text(f"{score} / 100", size=22, bold=True, color=score_color)
    else:
        draw_text("Score not available", color=colors.gray)

    # ── sentiment ─────────────────────────────────────────────────────────
    draw_section("MD&A Sentiment  (FinBERT)")
    s = result.get("sentiment", {})
    label = s.get("label", "n/a").upper()
    score_d = s.get("score", {})
    sent_color = TAG_COLOR_MAP.get(s.get("label", ""), colors.black)
    draw_text(label, size=12, bold=True, color=sent_color)
    draw_text(
        f"Positive: {score_d.get('positive', 0):.1%}   "
        f"Negative: {score_d.get('negative', 0):.1%}   "
        f"Neutral: {score_d.get('neutral', 0):.1%}",
        indent=10,
    )

    # ── analyst brief ─────────────────────────────────────────────────────
    draw_section("Groq Analyst Brief  (LLaMA 3.3-70B)")
    brief_text = result.get("brief", "No brief available.")
    draw_text(brief_text, indent=10, color=colors.HexColor("#374151"))

    # ── financials ────────────────────────────────────────────────────────
    fin = result.get("financials", {})
    if fin.get("available") is not False and fin:
        draw_section("Key Financials")
        fin_fields = [
            ("Revenue",           fin.get("revenue")),
            ("Net Income",        fin.get("net_income")),
            ("EPS (Diluted)",     fin.get("eps_diluted")),
            ("Gross Margin",      fin.get("gross_margin")),
            ("Operating Margin",  fin.get("operating_margin")),
            ("R&D Expense",       fin.get("rd_expense")),
            ("Total Assets",      fin.get("total_assets")),
        ]
        for label, val in fin_fields:
            if val:
                draw_text(f"{label}: {val}", indent=10)

    # ── forward guidance ──────────────────────────────────────────────────
    guidance = result.get("guidance", [])
    if guidance:
        draw_section(f"Forward Guidance Signals  ({len(guidance)} detected)")
        for g in guidance[:15]:  # cap at 15 to keep PDF concise
            color = TAG_COLOR_MAP.get(g.get("tag", ""), colors.black)
            draw_text(f"[{g.get('tag','?').upper()}]  {g.get('text', '')[:120]}",
                      color=color, indent=10)

    # ── risk delta ────────────────────────────────────────────────────────
    rd = result.get("risk_delta", {})
    added   = rd.get("added", [])
    removed = rd.get("removed", [])
    modified = rd.get("modified", [])

    if added or removed or modified:
        draw_section("Risk Factor Delta  (vs Prior Quarter)")
        for r in added[:8]:
            draw_text(f"+ {r[:130]}", color=TAG_COLOR_MAP["cautious"], indent=10)
        for r in removed[:8]:
            draw_text(f"- {r[:130]}", color=TAG_COLOR_MAP["optimistic"], indent=10)
        for item in modified[:5]:
            old = item["old"] if isinstance(item, dict) else item[0]
            new = item["new"] if isinstance(item, dict) else item[1]
            draw_text(f"~ {old[:110]}", color=TAG_COLOR_MAP["neutral"], indent=10)
            draw_text(f"  → {new[:110]}", color=TAG_COLOR_MAP["neutral"], indent=16)

    # ── footer ────────────────────────────────────────────────────────────
    ensure_space(30)
    y = margin
    c.setFillColor(colors.HexColor("#9ca3af"))
    c.setFont("Helvetica", 8)
    c.drawString(margin, y, f"Generated by FinSight · {date} · For research purposes only. Not investment advice.")

    c.save()
    return path
