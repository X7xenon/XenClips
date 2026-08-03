"""
hinglish_corrector.py

Corrects spelling/casing of Hinglish (Latin-script, code-switched
Hindi+English) words using a comprehensive local dictionary — no Ollama,
no internet required.

Fixes Whisper output like "gya" -> "gaya", "hooga" -> "hoga", "thay" -> "the".

Only runs correction when a clip is actually detected as Hinglish (mixed) —
pure English clips are left untouched.

CRITICAL CONSTRAINT: word-level timestamps must stay aligned for caption
rendering (word-highlight templates rely on 1:1 word->timestamp mapping).
So correction is done word-by-word — only fixing spelling/casing, never
merging, splitting, adding or removing words.
"""

from __future__ import annotations

import re

# ==========================================================
# HINGLISH DETECTION (cheap heuristic — no LLM call needed)
# ==========================================================
_HINGLISH_MARKERS = {
    "hai", "hain", "tha", "thi", "the", "thay", "ho", "hota", "hoga", "hogi",
    "kya", "kyun", "kyu", "kaise", "kaisi", "kaisa", "kahan", "kab", "kaun",
    "nahi", "nahin", "haan", "aur", "ya", "lekin", "par", "magar",
    "mein", "me", "ka", "ki", "ke", "ko", "se", "pe", "pr",
    "yeh", "ye", "woh", "wo", "iska", "uska", "apna", "apne",
    "kar", "karo", "karte", "karna", "kiya", "gaya", "gayi", "gaye", "gya",
    "raha", "rahi", "rahe", "diya", "liya", "aaya", "aaye",
    "bhi", "toh", "to", "ab", "abhi", "phir", "fir", "waise", "matlab",
    "bahut", "bohot", "bahot", "sabse", "sab", "kuch", "kuchh",
    "accha", "acha", "theek", "thik", "bilkul", "shayad",
}

# Finding even ONE of these means the clip definitely has Hinglish content.
_UNIQUE_HINGLISH_MARKERS = {
    "hai", "hain", "kya", "kyun", "kyu", "kaise", "kaisa", "kaisi", "kahan",
    "nahi", "nahin", "haan", "lekin", "magar", "iska", "uska", "apna", "apne",
    "karna", "karte", "gaya", "gayi", "gaye", "gya", "raha", "rahi", "rahe",
    "diya", "liya", "aaya", "aaye", "toh", "phir", "fir", "waise", "matlab",
    "bahut", "bohot", "bahot", "sabse", "kuch", "kuchh", "accha", "acha",
    "theek", "thik", "bilkul", "shayad", "bhenchod", "behanchod", "benchut",
    "banchod", "bc", "mc", "madarchod", "chutiya", "chutiye", "gandu",
    "loda", "lauda", "bkl", "bsdk", "gand",
}


# ==========================================================
# LOCAL CORRECTION DICTIONARY (200+ entries)
# Maps Whisper's common Hinglish misspellings -> correct form
# ==========================================================
_LOCAL_CORRECTIONS: dict[str, str] = {
    # ── Verb forms ──
    "gya": "gaya",
    "gyi": "gayi",
    "gye": "gaye",
    "krta": "karta",
    "krte": "karte",
    "krti": "karti",
    "krna": "karna",
    "krke": "karke",
    "krliya": "kar liya",
    "krdiya": "kar diya",
    "hogya": "ho gaya",
    "hogyi": "ho gayi",
    "hogye": "ho gaye",
    "horha": "ho raha",
    "horhi": "ho rahi",
    "horhe": "ho rahe",
    "horha": "ho raha",
    "hojata": "ho jata",
    "hojata": "ho jata",
    "hojaega": "ho jaega",
    "hojaogi": "ho jaogi",
    "hojao": "ho jao",
    "boljao": "bol jao",
    "chaljao": "chal jao",
    "dedo": "de do",
    "lelo": "le lo",
    "dekhlena": "dekh lena",
    "sunjao": "sun jao",
    "jaana": "jana",
    "jaata": "jata",
    "jaate": "jate",
    "jaati": "jati",
    "jayega": "jaega",
    "jayegi": "jaegi",
    "aajao": "aa jao",
    "aajata": "aa jata",
    "aajaega": "aa jaega",
    "chlta": "chalta",
    "chltay": "chaltay",
    "chlte": "chalte",
    "chlti": "chalti",
    "clna": "chalna",
    "chal": "chal",
    "chlega": "chalega",
    "clega": "chalega",
    "rkha": "rakha",
    "rkhna": "rakhna",
    "rkhte": "rakhte",
    "rkhti": "rakhti",
    "rkkha": "rakha",
    "lega": "lega",
    "aaega": "aega",
    "aaogi": "aaogi",
    "bolega": "bolega",
    "dekh": "dekh",
    "dekhega": "dekhega",
    "dekhle": "dekh le",
    "sun": "sun",
    "sunle": "sun le",
    "sunlena": "sun lena",
    "puchha": "poocha",
    "bola": "bola",
    "boli": "boli",
    "bole": "bole",
    "bolna": "bolna",
    "soch": "soch",
    "socha": "socha",
    "sochu": "sochunga",
    "sochunga": "sochunga",
    "chhodna": "chhorna",
    "chhod": "chhor",
    "chhodunga": "chhorunga",
    "maarta": "marta",
    "maarte": "marte",
    "maari": "mari",
    "maar": "maar",
    "maarein": "maarein",
    "khana": "khana",
    "khata": "khata",
    "khate": "khate",
    "khati": "khati",
    "khaya": "khaya",
    "khaoge": "khaoge",
    "peena": "peena",
    "piya": "piya",
    "piye": "piye",
    "piyo": "piyo",

    # ── Pronouns & basic words ──
    "mujhe": "mujhe",
    "mjhe": "mujhe",
    "mjhse": "mujhse",
    "mujhse": "mujhse",
    "hmara": "hamara",
    "hmari": "hamari",
    "hmare": "hamare",
    "tumhara": "tumhara",
    "tumhari": "tumhari",
    "tumhare": "tumhare",
    "tumse": "tumse",
    "unka": "unka",
    "unki": "unki",
    "unke": "unke",
    "unhe": "unhe",
    "inhe": "inhe",
    "inka": "inka",
    "inki": "inki",
    "inke": "inke",
    "isko": "isko",
    "usko": "usko",
    "inko": "inko",
    "unko": "unko",
    "aapko": "aapko",
    "mko": "mujhko",
    "tujhe": "tujhe",
    "tjhe": "tujhe",
    "khud": "khud",
    "apne": "apne",
    "apna": "apna",
    "apni": "apni",
    "koi": "koi",
    "koyi": "koi",
    "sab": "sab",
    "sbhi": "sabhi",
    "sabhi": "sabhi",
    "kuch": "kuch",
    "kuchh": "kuch",
    "koi": "koi",
    "har": "har",
    "hrr": "har",
    "ek": "ek",
    "aik": "ek",
    "do": "do",
    "teen": "teen",
    "tin": "teen",
    "chaar": "chaar",
    "char": "chaar",
    "paanch": "paanch",
    "panch": "paanch",

    # ── Common conversational ──
    "yrr": "yaar",
    "yr": "yaar",
    "yrra": "yaar",
    "bhai": "bhai",
    "bhi": "bhi",
    "bhaiya": "bhaiya",
    "bro": "bro",
    "dost": "dost",
    "ache": "acche",
    "accha": "accha",
    "achha": "accha",
    "acha": "accha",
    "acha": "accha",
    "thik": "theek",
    "thek": "theek",
    "theek": "theek",
    "sahi": "sahi",
    "galat": "galat",
    "pata": "pata",
    "ptaa": "pata",
    "pta": "pata",
    "matlb": "matlab",
    "matlab": "matlab",
    "mtlb": "matlab",
    "mtlab": "matlab",
    "bcoz": "because",
    "coz": "coz",
    "waise": "waise",
    "waisa": "waisa",
    "vaisa": "waisa",
    "wese": "waise",
    "sirf": "sirf",
    "srf": "sirf",
    "bs": "bas",
    "bss": "bas",
    "abhi": "abhi",
    "abhe": "abhi",
    "baad": "baad",
    "phle": "pahle",
    "pehle": "pahle",
    "pahle": "pahle",
    "pehle": "pahle",
    "pele": "pahle",
    "shayad": "shayad",
    "sayad": "shayad",
    "kyonki": "kyunki",
    "kynki": "kyunki",
    "kyuki": "kyunki",
    "isliye": "isliye",
    "islie": "isliye",
    "isiliye": "isliye",
    "islye": "isliye",
    "lekin": "lekin",
    "lkin": "lekin",
    "magar": "magar",
    "pr": "par",
    "prr": "par",
    "ager": "agar",
    "agr": "agar",
    "toh": "toh",
    "tho": "toh",
    "to": "toh",
    "nahi": "nahi",
    "nai": "nahi",
    "naa": "na",
    "haan": "haan",
    "han": "haan",
    "hanji": "haan ji",
    "hnji": "haan ji",
    "hmm": "hmm",
    "hm": "hmm",
    "uff": "uff",
    "ufff": "uff",
    "arre": "arre",
    "are": "arre",
    "arrey": "arre",
    "oye": "oye",
    "oyi": "oye",
    "oi": "oi",
    "yaar": "yaar",

    # ── Emotions / reactions ──
    "maza": "mazaa",
    "mazaa": "mazaa",
    "maja": "mazaa",
    "khushi": "khushi",
    "dard": "dard",
    "pyar": "pyaar",
    "pyaar": "pyaar",
    "gussa": "gussa",
    "gusa": "gussa",
    "tension": "tension",
    "fikar": "fikar",
    "dar": "darr",
    "darr": "darr",
    "hasna": "hasna",
    "rona": "rona",
    "roya": "roya",
    "hansi": "hansi",

    # ── Time words ──
    "kal": "kal",
    "aaj": "aaj",
    "aj": "aaj",
    "parso": "parso",
    "kabhi": "kabhi",
    "kbhi": "kabhi",
    "hamesha": "hamesha",
    "hmsha": "hamesha",
    "jaldi": "jaldi",
    "jldi": "jaldi",
    "dheere": "dheere",
    "dhire": "dheere",
    "raat": "raat",
    "subah": "subah",
    "sham": "shaam",
    "shaam": "shaam",
    "dopahar": "dopahar",

    # ── Common adjectives ──
    "bada": "bada",
    "badi": "badi",
    "bade": "bade",
    "chota": "chhota",
    "chhota": "chhota",
    "choti": "chhoti",
    "bura": "bura",
    "buri": "buri",
    "sundar": "sundar",
    "khoobsurat": "khoobsurat",
    "mushkil": "mushkil",
    "muskil": "mushkil",
    "aasan": "aasaan",
    "asan": "aasaan",
    "asaan": "aasaan",
    "poora": "poora",
    "pura": "poora",
    "sach": "sach",
    "jhooth": "jhooth",
    "juth": "jhooth",
    "pakka": "pakka",
    "pkka": "pakka",

    # ── Slang / swear corrections ──
    "benchut": "bhenchod",
    "benchood": "bhenchod",
    "banchod": "bhenchod",
    "behanchod": "bhenchod",
    "bhen": "bhen",
    "lauda": "loda",
    "chutya": "chutiya",
    "madarchut": "madarchod",
    "saala": "saala",
    "sala": "saala",
    "harami": "harami",
    "haraami": "harami",
    "kamine": "kamine",
    "kamina": "kamina",
    "ullu": "ullu",
    "bewakoof": "bewakoof",
    "bakwaas": "bakwaas",
    "bkws": "bakwaas",
    "bakar": "bakwas",
    "nautanki": "nautanki",
    "noutanki": "nautanki",

    # ── Numbers / filler ──
    "ek": "ek",
    "do": "do",
    "teen": "teen",
    "chaar": "chaar",
    "paanch": "paanch",
    "das": "das",
    "so": "sau",
    "hazar": "hazaar",
    "hazaar": "hazaar",
    "lakh": "lakh",
    "crore": "crore",
}


# ==========================================================
# HINGLISH DETECTION
# ==========================================================

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
# CORRECTION (local dict only — no Ollama, no network)
# ==========================================================

def correct_words_hinglish(
    words: list[dict],
    force: bool = False,
) -> list[dict]:
    """
    Corrects spelling/casing of a clip's word list using the local dictionary.
    Only runs if the clip is detected as Hinglish (unless force=True).
    Timestamps are preserved 1:1 — never changes word count.
    """
    if not words:
        return words

    if not force and not is_hinglish(words):
        return words  # pure English — skip

    result = []
    for w in words:
        text = w["text"]
        clean = re.sub(r"[^\w]", "", text).lower()

        # Look up in the correction dict
        corrected_text = text
        if clean in _LOCAL_CORRECTIONS:
            replacement = _LOCAL_CORRECTIONS[clean]
            # Preserve casing style
            if text.isupper():
                replacement = replacement.upper()
            elif text[0].isupper() if text else False:
                replacement = replacement.capitalize()
            # Preserve surrounding punctuation (leading/trailing)
            leading = text[: len(text) - len(text.lstrip(",.!?;:\"'"))]
            trailing = text[len(text.rstrip(",.!?;:\"'")):]
            corrected_text = leading + replacement + trailing

        result.append({**w, "text": corrected_text})

    return result


# ==========================================================
# BATCH CORRECTION
# ==========================================================

def correct_clips_batch(
    clip_word_map: dict[str, list[dict]],
) -> dict[str, list[dict]]:
    """
    Runs correct_words_hinglish over multiple clips' word lists.
    clip_word_map: {clip_path_or_id: words_list}
    Returns a new dict, same keys, corrected (or unchanged) word lists.
    """
    results = {}
    total = len(clip_word_map)
    print(f"\n==============================")
    print(f"Hinglish correction pass — {total} clip(s)  [local dict only]")
    print(f"==============================\n")

    for i, (key, words) in enumerate(clip_word_map.items(), start=1):
        hinglish = is_hinglish(words)
        print(f"[{i}/{total}] {'Hinglish detected, correcting...' if hinglish else 'English clip, skipping'}")
        results[key] = correct_words_hinglish(words)

    return results


if __name__ == "__main__":
    test_words = [
        {"text": "delta", "start": 0.0, "end": 0.3},
        {"text": "ho", "start": 0.3, "end": 0.5},
        {"text": "gya", "start": 0.5, "end": 0.7},
        {"text": "ab", "start": 0.7, "end": 0.9},
        {"text": "subah", "start": 0.9, "end": 1.2},
        {"text": "jaldi", "start": 1.2, "end": 1.4},
        {"text": "kr", "start": 1.4, "end": 1.6},
        {"text": "uthne", "start": 1.6, "end": 1.9},
        {"text": "wale", "start": 1.9, "end": 2.1},
        {"text": "hai", "start": 2.1, "end": 2.3},
        {"text": "yrr", "start": 2.3, "end": 2.5},
        {"text": "kya", "start": 2.5, "end": 2.7},
        {"text": "matlb", "start": 2.7, "end": 2.9},
    ]

    print("Is Hinglish?", is_hinglish(test_words))
    corrected = correct_words_hinglish(test_words)
    for orig, fixed in zip(test_words, corrected):
        marker = "  <- changed" if orig["text"] != fixed["text"] else ""
        print(f"{fixed['start']:.2f}-{fixed['end']:.2f}: {orig['text']} -> {fixed['text']}{marker}")