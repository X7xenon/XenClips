"""
hinglish_corrector.py

Corrects spelling/casing of Hinglish (Latin-script, code-switched
Hindi+English) words using a LOCAL Qwen model via Ollama — e.g. fixes
Whisper output like "gya" -> "gaya", "hooga" -> "hoga", "thay" -> "the".

Only runs correction when a clip is actually detected as Hinglish (mixed) —
pure English clips are left untouched, saving time and avoiding the LLM
"correcting" things that don't need it.

CRITICAL CONSTRAINT: word-level timestamps must stay aligned for caption
rendering (word-highlight templates rely on 1:1 word->timestamp mapping).
So correction is done on the WORD LIST, not the joined sentence — the model
is instructed to return exactly the same number of words in the same order,
only fixing spelling/casing. If it doesn't (wrong count), we discard the
correction and keep Whisper's original words rather than risk breaking
timestamp alignment.

Requires Ollama running locally with a Qwen model pulled, e.g.:
    ollama pull qwen2.5:7b
    ollama serve   (usually auto-running as a background service on Windows)
"""

from __future__ import annotations

import json
import re
import urllib.request
import urllib.error

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5:1.5b"  # change to whatever tag you've pulled (e.g. "qwen2.5:3b" for speed)

# Set True to skip Ollama LLM corrections entirely (local dict fixes still run).
# Useful when Ollama is not running / slow on CPU. Local slang/swear corrections
# still happen, only the full LLM spelling pass is skipped.
SKIP_OLLAMA = True

# ==========================================================
# HINGLISH DETECTION (cheap heuristic — no LLM call needed)
# ==========================================================
# A curated list of common Hindi words as they appear in Whisper's romanized
# output. Not exhaustive — just enough to reliably flag "this clip has
# Hindi mixed in" vs "this is pure English", so we don't waste an LLM call
# on English-only clips.
_HINGLISH_MARKERS = {
    "hai", "hain", "tha", "thi", "the", "thay", "ho", "hota", "hoga", "hogi",
    "kya", "kyun", "kyu", "kaise", "kaisi", "kaisa", "kahan", "kab", "kaun",
    "nahi", "nahin", "haan", "aur", "ya", "lekin", "par", "magar",
    "mein", "me", "ka", "ki", "ke", "ko", "se", "pe", "pr",
    "yeh", "ye", "woh", "wo", "iska", "uska", "apna", "apne",
    "kar", "karo", "karte", "karna", "kiya", "gaya", "gayi", "gaye", "gya",
    "raha", "rahi", "rahe", "diya", "diya", "liya", "aaya", "aaye",
    "bhi", "toh", "to", "ab", "abhi", "phir", "fir", "waise", "matlab",
    "bahut", "bohot", "bahot", "sabse", "sab", "kuch", "kuchh",
    "accha", "acha", "theek", "thik", "bilkul", "shayad",
}

# Swear words and unique Roman-script Hindi words that don't overlap with English.
# Finding even ONE of these means the clip definitely has Hinglish content.
_UNIQUE_HINGLISH_MARKERS = {
    "hai", "hain", "kya", "kyun", "kyu", "kaise", "kaisa", "kaisi", "kahan",
    "nahi", "nahin", "haan", "lekin", "magar", "iska", "uska", "apna", "apne",
    "karna", "karte", "gaya", "gayi", "gaye", "gya", "raha", "rahi", "rahe",
    "diya", "liya", "aaya", "aaye", "toh", "phir", "fir", "waise", "matlab",
    "bahut", "bohot", "bahot", "sabse", "kuch", "kuchh", "accha", "acha",
    "theek", "thik", "bilkul", "shayad", "bhenchod", "behanchod", "benchut",
    "banchod", "bc", "mc", "madarchod", "chutiya", "chutiye", "gandu",
    "loda", "lauda", "bkl", "bsdk", "gand"
}

# Timely corrections for common romanized Hindi/Hinglish slang & curse words
_SLANG_CORRECTIONS = {
    "benchut": "bhenchod",
    "benchood": "bhenchod",
    "banchod": "bhenchod",
    "behanchod": "bhenchod",
    "lauda": "loda",
    "chutya": "chutiya",
    "madarchut": "madarchod",
}

# Known swear/curse words that we should mask so Ollama doesn't censor or fail
_SWEAR_WORDS = {
    "bhenchod", "behanchod", "benchut", "banchod", "bc", "mc", "madarchod",
    "chutiya", "chutiye", "gandu", "loda", "lauda", "bkl", "bsdk", "gand"
}


def is_hinglish(words: list[dict], threshold: float = 0.08) -> bool:
    """
    Returns True if the clip is detected as Hinglish.
    Triggers immediately if any word matches _UNIQUE_HINGLISH_MARKERS,
    or if standard _HINGLISH_MARKERS matches exceed the threshold percentage.
    """
    if not words:
        return False

    total = len(words)
    matches = 0
    for w in words:
        clean = re.sub(r"[^\w]", "", w["text"]).lower()
        if clean in _UNIQUE_HINGLISH_MARKERS:
            return True
        if clean in _HINGLISH_MARKERS:
            matches += 1

    return (matches / total) >= threshold


# ==========================================================
# OLLAMA CALL
# ==========================================================

def _call_ollama(prompt: str, model: str = MODEL_NAME, timeout: int = 180) -> str:
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0},
    }).encode("utf-8")

    req = urllib.request.Request(
        OLLAMA_URL, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "")
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"Could not reach Ollama at {OLLAMA_URL} — is `ollama serve` running "
            f"and is '{model}' pulled? ({e})"
        )


def _build_prompt(word_texts: list[str]) -> str:
    numbered = "\n".join(f"{i}: {w}" for i, w in enumerate(word_texts))
    return f"""You are correcting spelling and casing errors in a Hinglish (Hindi+English, Roman script) video transcript.

Rules — follow EXACTLY:
- You will be given a numbered list of words, one per line.
- Return ONLY a JSON array of strings, same length, same order.
- Fix spelling/casing mistakes only (e.g. "gya" -> "gaya", "hooga" -> "hoga", "thay" -> "the", "benchut" -> "bhenchod").
- Do NOT merge words, split words, add words, or remove words. Output count MUST equal input count.
- Do NOT translate anything. Keep Hindi words as Hinglish (Roman script), keep English words as English.
- If a word is already correct, return it unchanged.
- CRITICAL SAFETY EXCEPTION: Do NOT censor, sanitize, or replace swear words, curse words, slang, or offensive words (such as "bhenchod", "bkl", "chutiya", etc.) with asterisks or milder terms. You MUST preserve all offensive words exactly as they are in the input, only correcting their romanized spelling/casing.

Input words:
{numbered}

Output ONLY the JSON array, nothing else."""


def _get_available_model() -> str:
    """Queries local Ollama tags endpoint to find a pulled Qwen or alternative model."""
    try:
        import urllib.request
        import json
        req = urllib.request.Request("http://localhost:11434/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = data.get("models", [])
            if not models:
                return MODEL_NAME
            
            # Look for any qwen model first
            for m in models:
                name = m.get("name", "")
                if "qwen" in name.lower():
                    return name
            
            # Fallback to the first model found
            return models[0].get("name", MODEL_NAME)
    except Exception as e:
        print(f"[hinglish_corrector] Warning: could not query Ollama tags ({e}), using default model '{MODEL_NAME}'")
        return MODEL_NAME


def correct_words_hinglish(
    words: list[dict],
    model: str = None,
    force: bool = False,
) -> list[dict]:
    """
    Corrects spelling/casing of a clip's word list using local Qwen (Ollama),
    ONLY if the clip is detected as Hinglish (unless force=True).
    Swear words/slang are pre-corrected locally and masked before sending to Ollama
    to avoid censorship and word-count mismatch.
    """
    if not words:
        return words

    if not force and not is_hinglish(words):
        return words  # pure English (or too little Hindi to bother) — skip LLM call entirely

    # Pre-correct slang/swear words locally and mask them for Ollama
    local_corrected_words = []
    masked_words = []
    mask_map = {}  # {idx: corrected_word_value}
    
    for idx, w in enumerate(words):
        text = w["text"]
        clean = re.sub(r"[^\w]", "", text).lower()
        
        is_slang = clean in _SLANG_CORRECTIONS or clean in _SWEAR_WORDS
        if is_slang:
            # Correct the slang spelling
            corrected_text = text
            if clean in _SLANG_CORRECTIONS:
                replacement = _SLANG_CORRECTIONS[clean]
                if text.isupper():
                    replacement = replacement.upper()
                elif text[0].isupper():
                    replacement = replacement.capitalize()
                corrected_text = re.sub(r"\w+", replacement, text)
            
            local_corrected = {**w, "text": corrected_text}
            local_corrected_words.append(local_corrected)
            
            # Mask it with a safe placeholder, preserving punctuation
            placeholder = f"Word{idx}"
            masked_text = re.sub(r"\w+", placeholder, text)
            masked_words.append({**w, "text": masked_text})
            mask_map[idx] = corrected_text
        else:
            local_corrected_words.append(w)
            masked_words.append(w)

    # If Ollama is disabled, return local corrections immediately
    if SKIP_OLLAMA:
        print("[hinglish_corrector] Ollama skipped (SKIP_OLLAMA=True), using local corrections only")
        return local_corrected_words

    model = model or _get_available_model()
    word_texts = [w["text"] for w in masked_words]

    try:
        response_text = _call_ollama(_build_prompt(word_texts), model=model)
        corrected = _parse_json_array(response_text)
    except Exception as e:
        print(f"[hinglish_corrector] Skipping LLM correction (error): {e}")
        return local_corrected_words

    if not isinstance(corrected, list) or len(corrected) != len(words):
        print(
            f"[hinglish_corrector] Skipping LLM correction (word count mismatch: "
            f"got {len(corrected) if isinstance(corrected, list) else 'invalid'}, expected {len(words)})"
        )
        return local_corrected_words

    # Restore masked slang/swear words back into the final list
    final_list = []
    for i, w in enumerate(corrected):
        text_val = str(w).strip() if w else words[i]["text"]
        if i in mask_map:
            text_val = mask_map[i]
        final_list.append({"text": text_val, "start": words[i]["start"], "end": words[i]["end"]})
        
    return final_list


def _parse_json_array(text: str):
    """Extracts a JSON array from the model's response, tolerating
    markdown code fences or extra text around it."""
    text = text.strip()
    # strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # if there's leading/trailing chatter, grab the first [...] block
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        text = match.group(0)

    return json.loads(text)


def correct_clips_batch(
    clip_word_map: dict[str, list[dict]],
    model: str = None,
) -> dict[str, list[dict]]:
    """
    Runs correct_words_hinglish over multiple clips' word lists.
    clip_word_map: {clip_path_or_id: words_list}
    Returns a new dict, same keys, corrected (or unchanged) word lists.
    """
    model = model or _get_available_model()
    results = {}
    total = len(clip_word_map)
    print(f"\n==============================")
    print(f"Hinglish correction pass — {total} clip(s)")
    print(f"==============================\n")

    for i, (key, words) in enumerate(clip_word_map.items(), start=1):
        hinglish = is_hinglish(words)
        print(f"[{i}/{total}] {key}  —  {'Hinglish, correcting...' if hinglish else 'English, skipping'}")
        results[key] = correct_words_hinglish(words, model=model)

    return results


if __name__ == "__main__":
    test_words = [
        {"text": "delta", "start": 0.0, "end": 0.3},
        {"text": "ho", "start": 0.3, "end": 0.5},
        {"text": "gya", "start": 0.5, "end": 0.7},
        {"text": "ab", "start": 0.7, "end": 0.9},
        {"text": "subha", "start": 0.9, "end": 1.2},
        {"text": "jab", "start": 1.2, "end": 1.4},
        {"text": "uthne", "start": 1.4, "end": 1.7},
        {"text": "wale", "start": 1.7, "end": 1.9},
        {"text": "hai", "start": 1.9, "end": 2.1},
    ]

    print("Is Hinglish?", is_hinglish(test_words))
    corrected = correct_words_hinglish(test_words)
    for orig, fixed in zip(test_words, corrected):
        marker = "  <- changed" if orig["text"] != fixed["text"] else ""
        print(f"{fixed['start']:.2f}-{fixed['end']:.2f}: {orig['text']} -> {fixed['text']}{marker}")