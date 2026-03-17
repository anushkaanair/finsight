from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib import colors

TAG_COLOR_MAP = {
    "optimistic": colors.green,
    "cautious": colors.red,
    "neutral": colors.orange,
}


def export_pdf(brief: dict, output_path: str | None = None) -> str:
    ticker = brief["ticker"]
    quarter = brief["quarter"]
    path = output_path or f"{ticker}_{quarter}_finsight.pdf"

    c = pdf_canvas.Canvas(path, pagesize=A4)
    width, height = A4
    margin = inch
    y = height - margin

    def draw_line(text, size=10, bold=False, color=colors.black, indent=0):
        nonlocal y
        c.setFont("Courier-Bold" if bold else "Courier", size)
        c.setFillColor(color)
        c.drawString(margin + indent, y, str(text)[:110])
        y -= size + 4
        if y < margin:
            c.showPage()
            nonlocal y
            y = height - margin

    draw_line("━" * 60, bold=True)
    draw_line(f"FINSIGHT ANALYST BRIEF", size=14, bold=True)
    draw_line(f"{ticker} | {quarter} | {brief['generated_at'][:10]}")
    draw_line("━" * 60, bold=True)
    y -= 8

    s = brief["sentiment"]
    draw_line("SENTIMENT", bold=True)
    draw_line(
        f"  {s['label'].upper()}  "
        f"(Pos: {s['score']['positive']:.1%}  "
        f"Neg: {s['score']['negative']:.1%}  "
        f"Neu: {s['score']['neutral']:.1%})",
        indent=10,
    )
    y -= 8

    draw_line("FORWARD GUIDANCE SIGNALS", bold=True)
    for g in brief["guidance"]:
        color = TAG_COLOR_MAP.get(g["tag"], colors.black)
        draw_line(f"  [{g['tag'].upper()}] {g['text'][:90]}", color=color, indent=10)
    y -= 8

    draw_line("RISK FACTOR CHANGES", bold=True)
    for r in brief["risk_delta"]["added"]:
        draw_line(f"  + {r[:100]}", color=colors.green, indent=10)
    for r in brief["risk_delta"]["removed"]:
        draw_line(f"  - {r[:100]}", color=colors.red, indent=10)
    for old, new in brief["risk_delta"]["modified"]:
        draw_line(f"  ~ {old[:80]}", color=colors.orange, indent=10)
        draw_line(f"    → {new[:80]}", color=colors.orange, indent=14)
    y -= 8

    draw_line("Q-over-Q RETRIEVED CONTEXT", bold=True)
    for q_key, chunks in brief["rag_results"].items():
        draw_line(f"  {q_key}", bold=True, indent=10)
        for chunk in chunks[:2]:
            draw_line(f'    "{chunk["text"][:90]}"', indent=14)

    c.save()
    return path
