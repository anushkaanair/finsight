import difflib
import re


def _split_sentences(text: str) -> list:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def compute_risk_delta(old_text: str, new_text: str) -> dict:
    old_sents = _split_sentences(old_text)
    new_sents = _split_sentences(new_text)

    matcher = difflib.SequenceMatcher(None, old_sents, new_sents, autojunk=False)
    added, removed, modified = [], [], []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "insert":
            added.extend(new_sents[j1:j2])
        elif tag == "delete":
            removed.extend(old_sents[i1:i2])
        elif tag == "replace":
            old_chunk = old_sents[i1:i2]
            new_chunk = new_sents[j1:j2]
            for k in range(max(len(old_chunk), len(new_chunk))):
                old_s = old_chunk[k] if k < len(old_chunk) else ""
                new_s = new_chunk[k] if k < len(new_chunk) else ""
                if old_s and new_s:
                    modified.append({"old": old_s, "new": new_s})
                elif old_s:
                    removed.append(old_s)
                else:
                    added.append(new_s)

    return {"added": added, "removed": removed, "modified": modified}
