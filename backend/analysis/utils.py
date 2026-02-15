"""Shared text preprocessing utilities for analysis modules."""
import re


def split_sentences(text: str) -> list[str]:
    """Split text into sentences on .!? boundaries."""
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def split_paragraphs(text: str, max_words: int = 150) -> list[str]:
    """Split text into paragraphs capped at *max_words* words."""
    sentences = split_sentences(text)
    paragraphs, current, word_count = [], [], 0
    for sentence in sentences:
        words = len(sentence.split())
        if word_count + words > max_words and current:
            paragraphs.append(" ".join(current))
            current, word_count = [], 0
        current.append(sentence)
        word_count += words
    if current:
        paragraphs.append(" ".join(current))
    return paragraphs


def truncate(text: str, max_chars: int = 1500) -> str:
    """Hard-truncate text to *max_chars* characters."""
    return text[:max_chars] if len(text) > max_chars else text
