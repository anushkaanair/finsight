from __future__ import annotations
import re
from functools import lru_cache
import torch
from transformers import BertTokenizer, BertForSequenceClassification

MODEL_NAME = "ProsusAI/finbert"


@lru_cache(maxsize=1)
def _load_model():
    tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)
    model = BertForSequenceClassification.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


def score_text(text: str) -> dict:
    tokenizer, model = _load_model()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**inputs).logits
    probs = torch.softmax(logits, dim=-1).squeeze().tolist()
    return {"positive": probs[0], "negative": probs[1], "neutral": probs[2]}


def aggregate_scores(scored_paragraphs: list) -> dict:
    total_weight = sum(w for _, w in scored_paragraphs)
    if total_weight == 0:
        return {"positive": 0.0, "negative": 0.0, "neutral": 1.0}
    result = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    for scores, weight in scored_paragraphs:
        for label in result:
            result[label] += scores[label] * weight / total_weight
    return result


def _split_paragraphs(text: str, max_words: int = 150) -> list:
    sentences = re.split(r"(?<=[.!?])\s+", text)
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


def score_mda(mda_text: str) -> dict:
    paragraphs = _split_paragraphs(mda_text)
    scored = [(score_text(p), len(p)) for p in paragraphs if p.strip()]
    aggregated = aggregate_scores(scored)
    label = max(aggregated, key=aggregated.get)
    return {"score": aggregated, "label": label, "paragraph_count": len(paragraphs)}
