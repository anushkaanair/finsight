"""
Groq-powered chat engine — replaces flan-t5-base.
Uses llama-3.3-70b-versatile (free tier, ~100k tokens/min).
Falls back gracefully if GROQ_API_KEY is missing.
"""
from __future__ import annotations
import os
import logging

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are a senior equity research analyst with deep expertise in SEC filings, \
financial statement analysis, and investment risk assessment. You have 15 years of experience \
at a top-tier investment bank analysing 10-K and 10-Q filings.

When answering questions:
- Be precise and cite specific numbers or phrases from the filing context
- Structure your answer clearly (use bullet points for lists)
- Highlight material changes or red flags
- Keep answers concise but complete (3-6 sentences typically)
- If the context doesn't contain enough information, say so clearly"""


def _groq_answer(query: str, context: str) -> str:
    """Call Groq API. Returns answer string."""
    try:
        from groq import Groq  # type: ignore
    except ImportError:
        return _fallback_answer(query, context)

    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return _fallback_answer(query, context)

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"SEC Filing Context:\n{context[:6000]}\n\n"
                        f"Analyst Question: {query}"
                    ),
                },
            ],
            max_tokens=600,
            temperature=0.1,
        )
        return completion.choices[0].message.content
    except Exception as e:
        logger.warning("Groq API error: %s — using fallback", e)
        return _fallback_answer(query, context)


def _fallback_answer(query: str, context: str) -> str:
    """Simple keyword extraction fallback when Groq is unavailable."""
    sentences = [s.strip() for s in context.replace("\n", " ").split(".") if s.strip()]
    q_words = set(query.lower().split())
    scored = []
    for s in sentences:
        score = sum(1 for w in q_words if w in s.lower())
        if score > 0:
            scored.append((score, s))
    scored.sort(reverse=True)
    top = [s for _, s in scored[:3]]
    if top:
        return ". ".join(top) + "."
    return (
        "I couldn't find a direct answer in the filing context. "
        "Please ensure you've run an analysis first and try rephrasing your question."
    )


def answer_question(query: str, context: str, sources: list | None = None) -> dict:
    if not context.strip():
        return {
            "answer": (
                "No filing data loaded. Run an analysis on a ticker first, "
                "then I can answer questions about it."
            ),
            "sources": [],
        }
    answer = _groq_answer(query, context)
    return {"answer": answer, "sources": sources or []}
