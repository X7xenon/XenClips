"""
whisper_transcriber.py

CPU-optimized Faster-Whisper transcription.

Uses:
deepdml/faster-whisper-large-v3-turbo-ct2 (local CT2 model, offline)

Returns REAL word-level timestamps, clip-relative (0 = clip start) since
this always runs on an already-cut raw clip, not the full video.

Model Folder:
X:\\Millionaire\\Shorts_automation\\English\\model
"""

from __future__ import annotations

import os
from typing import Optional

from faster_whisper import WhisperModel

# ==========================================================
# CONFIG
# ==========================================================

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")

DEVICE = "cpu"

# Best for CPU
COMPUTE_TYPE = "int8"

# Use "smart" auto-detect (None) — the transcriber will do a fast language
# detect pass first, then choose "hi" or "en" accordingly. This prevents
# Whisper from translating Hindi speech into English (which happens when
# "en" is forced on a code-switched clip) while still correctly handling
# pure English content.
DEFAULT_LANGUAGE = None

# beam_size=5 is the standard Whisper default and gives the highest accuracy.
# More beams = more decode paths explored = better word choices, especially
# for accented/code-switched Hinglish speech. Slower than beam_size=3 but
# the quality jump is worth it. This is the #1 lever for accuracy without
# downloading a new model.
BEAM_SIZE = 5

# best_of only affects temperature>0 sampling (fallback decoding when the
# model is uncertain) — with temperature=0 (greedy/deterministic) it's
# unused, so it's dropped entirely rather than kept as dead config.
TEMPERATURE = 0.0

# VAD (voice activity detection) trims silence before transcribing — the
# defaults are sometimes a bit aggressive and can clip the start/end of
# quieter speech. Padding + a shorter min-silence threshold catches more of
# the actual speech without including long dead air.
VAD_PARAMETERS = dict(min_silence_duration_ms=500, speech_pad_ms=200)


# ==========================================================
# DEVANAGARI → ROMAN TRANSLITERATION
# ==========================================================
# Lightweight built-in transliterator: maps Devanagari (Hindi) characters to
# their closest Roman/Latin equivalents for natural Hinglish output.
# No external pip dependencies needed.

_DEVANAGARI_MAP = {
    # Vowels
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an',
    'अः': 'ah',
    # Vowel marks (matras)
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ः': 'h', 'ँ': 'n',
    # Consonants
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'w': 'w',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gya',
    # Nukta variants
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh',
    'फ़': 'f',
    # Halant (virama) — suppresses inherent 'a'
    '्': '',
    # Visarga and Avagraha
    'ऽ': '',
}

# Devanagari digits
_DEVANAGARI_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
}


def _has_devanagari(text: str) -> bool:
    """Returns True if the text contains any Devanagari characters."""
    for ch in text:
        if '\u0900' <= ch <= '\u097F':  # Devanagari Unicode block
            return True
    return False


def _transliterate_devanagari(text: str) -> str:
    """Transliterates Devanagari text to Roman/Latin script (Hinglish style).
    Handles conjuncts, inherent 'a' vowel, and mixed Devanagari+Latin text."""
    if not _has_devanagari(text):
        return text

    result = []
    i = 0
    chars = list(text)
    length = len(chars)

    while i < length:
        ch = chars[i]

        # Non-Devanagari character — pass through as-is
        if not ('\u0900' <= ch <= '\u097F'):
            # Devanagari digit?
            if ch in _DEVANAGARI_DIGITS:
                result.append(_DEVANAGARI_DIGITS[ch])
            else:
                result.append(ch)
            i += 1
            continue

        # Check for multi-char conjuncts first (e.g. क्ष, त्र, ज्ञ)
        if i + 2 < length:
            trigram = ch + chars[i + 1] + chars[i + 2]
            if trigram in _DEVANAGARI_MAP:
                result.append(_DEVANAGARI_MAP[trigram])
                # Check if next char after trigram is a matra or halant
                i += 3
                if i < length and chars[i] in _DEVANAGARI_MAP and chars[i] not in 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह':
                    result.append(_DEVANAGARI_MAP[chars[i]])
                    i += 1
                elif i < length and chars[i] != '्':
                    # Add inherent 'a' if no matra/halant follows
                    pass
                continue

        # Vowel (standalone)
        if ch in 'अआइईउऊऋएऐओऔ':
            result.append(_DEVANAGARI_MAP.get(ch, ch))
            i += 1
            continue

        # Vowel sign (matra) — already handled after consonant, but just in case
        if ch in 'ािीुूृेैोौंःँ':
            result.append(_DEVANAGARI_MAP.get(ch, ''))
            i += 1
            continue

        # Halant — suppress inherent 'a'
        if ch == '्':
            i += 1
            continue

        # Consonant
        roman = _DEVANAGARI_MAP.get(ch, ch)
        result.append(roman)
        i += 1

        # Check what follows the consonant
        if i < length:
            next_ch = chars[i]
            if next_ch == '्':  # Halant — no inherent 'a', move past halant
                i += 1
            elif next_ch in 'ािीुूृेैोौंःँ':  # Matra replaces inherent 'a'
                result.append(_DEVANAGARI_MAP.get(next_ch, ''))
                i += 1
            elif '\u0900' <= next_ch <= '\u097F' or next_ch in ' .,!?;:':  # Another Devanagari char or punctuation
                # Add inherent 'a'
                result.append('a')
            else:
                # Non-Devanagari follows (Latin text, etc.) — add inherent 'a'
                result.append('a')
        else:
            # End of string — add inherent 'a' for final consonant
            result.append('a')

    raw = ''.join(result)

    # Post-processing: schwa deletion (Hindi drops word-final inherent 'a')
    # In Hindi, the inherent 'a' at the end of a word is almost always silent.
    # e.g. 'kara' → 'kar', 'baahara' → 'baahar', 'namaste' stays 'namaste'
    # We strip trailing 'a' unless the word would become empty or a single char,
    # or the 'a' is part of a long vowel (aa, ee, etc.).
    if len(raw) > 2 and raw.endswith('a') and not raw.endswith('aa'):
        raw = raw[:-1]

    # Normalize double vowels to more natural Hinglish:
    # 'aa' stays as 'aa' (common in Hinglish: "baat", "aaj")
    # 'ee' → 'i' at end of word, 'ee' in middle stays (sounds right in Hinglish)  
    # 'oo' → 'u' at end of word
    # But keep 'ee'/'oo' in middle for readability
    if raw.endswith('ee'):
        raw = raw[:-2] + 'i'
    if raw.endswith('oo'):
        raw = raw[:-2] + 'u'

    return raw

# ==========================================================

_model: WhisperModel | None = None


def get_whisper_model() -> WhisperModel:
    global _model

    if _model is None:
        print("\n==============================")
        print("Loading Whisper Turbo...")
        print("==============================")

        _model = WhisperModel(
            MODEL_PATH,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            local_files_only=True,  # never touch the network — model is already local
        )

        print("Model Loaded!\n")

    return _model


def detect_language(clip_path: str) -> tuple[str, bool]:
    """Fast language detection using the first audio segment only.
    Returns (language_code, is_hindi) tuple.

    Uses language_detection_segments=1 so Whisper only looks at the first
    ~30s audio chunk for language detection — no full decode, very fast.
    """
    model = get_whisper_model()
    _, info = model.transcribe(
        clip_path,
        language=None,                  # let Whisper auto-detect
        beam_size=1,                    # greedy — fast enough for detection
        word_timestamps=False,
        vad_filter=True,
        language_detection_segments=1,  # only look at first segment (~30s)
    )
    lang = info.language
    prob = round(info.language_probability, 3)
    print(f"  [lang-detect] detected={lang!r} prob={prob}")
    is_hindi = lang in ("hi", "mr", "ne", "ur", "pa")
    return lang, is_hindi


def transcribe_clip_words(
    clip_path: str,
    language: Optional[str] = DEFAULT_LANGUAGE,
    beam_size: int = BEAM_SIZE,
    verbose: bool = False,
) -> list[dict]:
    """
    Transcribes a single (already-cut) clip and returns real word-level
    timestamps, clip-relative:

        [{"text": "hello", "start": 0.32, "end": 0.61}, ...]

    verbose=True prints detected language + per-segment text (useful when
    running one clip manually via the CLI below); kept False by default so
    batch runs over many clips don't flood the console.
    """
    if not os.path.exists(clip_path):
        raise FileNotFoundError(clip_path)

    model = get_whisper_model()

    # Smart language selection
    is_hindi = False
    if language is None:
        language, is_hindi = detect_language(clip_path)
        if verbose:
            print(f"  [auto-selected language: {language!r}, is_hindi={is_hindi}]")
    elif language == "hi":
        is_hindi = True

    # Choose initial_prompt based on language
    if is_hindi:
        # For Hindi/Hinglish: transcribe with language='hi' so Whisper uses
        # its Hindi acoustic model, but we instruct it to use Roman/Hinglish
        # script via the initial prompt. This gives cleaner Hinglish captions
        # than Devanagari->transliteration.
        prompt = "Hinglish conversation. Write words in Roman script only, no Devanagari."
        transcribe_language = "hi"
    else:
        prompt = "Conversation in English."
        transcribe_language = language

    segments, info = model.transcribe(
        clip_path,
        language=transcribe_language,
        beam_size=beam_size,
        temperature=TEMPERATURE,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=VAD_PARAMETERS,
        condition_on_previous_text=False,
        initial_prompt=prompt,
    )

    if verbose:
        print("-------------")
        print("Detected Language :", info.language)
        print("Probability       :", round(info.language_probability, 3))
        print("-------------\n")

    words = []
    for segment in segments:
        if verbose:
            print(f"[{segment.start:6.2f} -> {segment.end:6.2f}]", segment.text)

        if segment.words is None:
            continue

        for word in segment.words:
            text = word.word.strip()
            if not text:
                continue

            # If Whisper still outputs Devanagari despite our prompt, transliterate it
            if is_hindi and _has_devanagari(text):
                text = _transliterate_devanagari(text)
                # Skip if transliteration produced garbage (empty or just 'a')
                if not text or text.strip() in ("", "a", "aa"):
                    continue

            words.append({
                "text": text,
                "start": float(word.start),
                "end": float(word.end),
            })

    if is_hindi and verbose:
        print(f"  [Hindi/Hinglish clip — Roman script output]")

    return words


def transcribe_clips_batch(
    clip_paths: list[str],
    language: Optional[str] = DEFAULT_LANGUAGE,
    beam_size: int = BEAM_SIZE,
) -> dict[str, list[dict]]:
    """
    Transcribes multiple raw clips sequentially (CPU-only laptop — no
    parallelism, running multiple Whisper instances at once would thrash
    the same cores rather than speed things up). Returns
    {clip_path: [words...]}. A clip that fails transcribes to an empty list
    rather than crashing the whole batch.
    """
    results = {}
    total = len(clip_paths)

    print("\n==============================")
    print(f"Transcribing {total} clip(s)  (beam_size={beam_size}, {COMPUTE_TYPE})")
    print("==============================\n")

    for i, clip in enumerate(clip_paths, start=1):
        print(f"🎙  [{i}/{total}] {os.path.basename(clip)}")
        try:
            words = transcribe_clip_words(clip, language=language, beam_size=beam_size, verbose=False)
            print(f"   ✅ {len(words)} words")
        except Exception as e:
            print(f"   ❌ Failed: {e}")
            words = []
        results[clip] = words

    return results


if __name__ == "__main__":
    clip = input("Clip path: ").strip()

    print("\nLanguage")
    print("---------------")
    print("Default is auto-detect (outputs in detected language, then transliterates to Roman).")
    print("Press Enter to use the default. Override if needed:")
    print("  en   -> Force English (may translate Hindi to English — NOT recommended)")
    print("  hi   -> Force Hindi (outputs Devanagari, auto-transliterated to Roman)\n")

    lang = input(f"Language [{DEFAULT_LANGUAGE}]: ").strip().lower()
    if lang == "":
        lang = DEFAULT_LANGUAGE
    elif lang == "auto":
        lang = None

    words = transcribe_clip_words(clip_path=clip, language=lang, verbose=True)

    print("\n==============================")
    print("First 40 Words")
    print("==============================\n")
    for word in words[:40]:
        print(f"{word['start']:6.2f}  -> {word['end']:6.2f}   {word['text']}")

    print("\n==============================")
    print("Summary")
    print("==============================")
    print(f"Total Words : {len(words)}")