from __future__ import annotations
from functools import lru_cache
from transformers import T5ForConditionalGeneration, T5Tokenizer

MODEL_NAME = "google/flan-t5-base"
MAX_INPUT_TOKENS = 512
MAX_OUTPUT_TOKENS = 200


@lru_cache(maxsize=1)
def _load_model():
    tokenizer = T5Tokenizer.from_pretrained(MODEL_NAME)
    model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


def _build_prompt(query: str, context: str) -> str:
    truncated = context[:1500] if len(context) > 1500 else context
    return (
        f"You are a financial analyst assistant. Use the context below to answer the question.\n\n"
        f"Context: {truncated}\n\n"
        f"Question: {query}\n\n"
        f"Answer:"
    )


def answer_question(query: str, context: str, sources: list | None = None) -> dict:
    if not context.strip():
        return {
            "answer": "I don't have enough filing data loaded to answer that. Please run an analysis first.",
            "sources": [],
        }

    prompt = _build_prompt(query, context)
    tokenizer, model = _load_model()
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=MAX_INPUT_TOKENS)
    outputs = model.generate(
        **inputs,
        max_new_tokens=MAX_OUTPUT_TOKENS,
        num_beams=4,
        early_stopping=True,
    )
    answer = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return {"answer": answer, "sources": sources or []}
