from datetime import datetime


def assemble_brief(
    ticker: str,
    quarter: str,
    sentiment: dict,
    guidance: list,
    risk_delta: dict,
    rag_results: dict,
    prior_sentiment: dict | None = None,
) -> dict:
    trend = None
    if prior_sentiment:
        curr = sentiment["score"]["positive"] - sentiment["score"]["negative"]
        prev = prior_sentiment["score"]["positive"] - prior_sentiment["score"]["negative"]
        trend = "up" if curr > prev else "down" if curr < prev else "flat"

    return {
        "ticker": ticker.upper(),
        "quarter": quarter,
        "generated_at": datetime.utcnow().isoformat(),
        "sentiment": {**sentiment, "trend": trend},
        "guidance": guidance,
        "risk_delta": risk_delta,
        "rag_results": rag_results,
    }
