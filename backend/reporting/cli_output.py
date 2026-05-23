from rich.console import Console

console = Console()

TREND_ARROW = {"up": "[green]↑[/green]", "down": "[red]↓[/red]", "flat": "→", None: ""}
TAG_COLOR = {"optimistic": "green", "cautious": "red", "neutral": "yellow"}


def print_brief(brief: dict) -> None:
    console.print(f"\n[bold cyan]━━━ FINSIGHT ANALYST BRIEF ━━━[/bold cyan]")
    console.print(f"[bold]{brief['ticker']}[/bold] | {brief['quarter']} | {brief['generated_at'][:10]}\n")

    s = brief["sentiment"]
    arrow = TREND_ARROW.get(s.get("trend"))
    label_color = TAG_COLOR.get(s["label"], "white")
    console.print(f"[bold]SENTIMENT[/bold]  [{label_color}]{s['label'].upper()}[/{label_color}] {arrow}")
    console.print(
        f"  Positive: {s['score']['positive']:.2%}  "
        f"Negative: {s['score']['negative']:.2%}  "
        f"Neutral: {s['score']['neutral']:.2%}\n"
    )

    console.print("[bold]FORWARD GUIDANCE SIGNALS[/bold]")
    for g in brief["guidance"]:
        color = TAG_COLOR.get(g["tag"], "white")
        console.print(f"  [{color}][{g['tag'].upper()}][/{color}] {g['text']}")
    console.print()

    rd = brief["risk_delta"]
    console.print("[bold]RISK FACTOR CHANGES[/bold]")
    for r in rd["added"]:
        console.print(f"  [green]+[/green] {r}")
    for r in rd["removed"]:
        console.print(f"  [red]-[/red] {r}")
    for item in rd["modified"]:
        old = item["old"] if isinstance(item, dict) else item[0]
        new = item["new"] if isinstance(item, dict) else item[1]
        console.print(f"  [yellow]~[/yellow] {old[:60]}... → {new[:60]}...")
    console.print()

    console.print("[bold]Q-over-Q RETRIEVED CONTEXT[/bold]")
    for quarter_key, chunks in brief["rag_results"].items():
        console.print(f"  [cyan]{quarter_key}[/cyan]")
        for chunk in chunks[:2]:
            console.print(f'    "{chunk["text"][:120]}..."')
    console.print("[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]\n")
