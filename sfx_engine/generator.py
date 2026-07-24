import os
import json
import re

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_CATEGORIES_PATH = os.path.join(os.path.dirname(_SCRIPT_DIR), "assets", "sfx", "categories.json")

def load_categories():
    if not os.path.exists(_CATEGORIES_PATH):
        return {}
    with open(_CATEGORIES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# Built-in animation inferences based on the template
# This helps us generate "caption_pop" or "zoom" events
TEMPLATE_ANIMATIONS = {
    "alex_hormozi": "caption_pop",
    "tiktok_viral": "caption_pop",
    "mrbeast": "bounce",
    "gaming": "shake",
    "motivational": "zoom"
}

def clean_word(word: str) -> str:
    return re.sub(r"[^\w]", "", word).lower()

def generate_events(words: list[dict], template: str = "alex_hormozi", min_confidence: float = 0.7) -> list[dict]:
    """
    Generate SFX events based on transcript words, punctuation, and template animations.
    """
    categories = load_categories()
    
    # Reverse lookup for categories
    word_to_category = {}
    for cat, kw_list in categories.items():
        for kw in kw_list:
            word_to_category[kw.lower()] = cat

    events = []
    
    # Base animation for this template
    template_anim = TEMPLATE_ANIMATIONS.get(template, None)

    for i, w in enumerate(words):
        text = w["text"]
        start_time = w["start"]
        
        c_word = clean_word(text)
        
        # 1. Punctuation checks
        is_exclamation = "!" in text
        is_question = "?" in text
        
        # 2. Capitalization (start of sentence heuristic)
        # Note: Whisper often capitalizes the first word of a sentence.
        is_capitalized = text and text[0].isupper() and c_word
        
        # 3. Keyword matching
        matched_cat = word_to_category.get(c_word)
        
        # 4. Emoji matching (simple check for non-ascii characters that might be emojis)
        # In this implementation we assume emojis are in the text block or passed separately.
        # But let's check for typical emoji unicode ranges
        has_emoji = bool(re.search(r"[\U00010000-\U0010ffff]", text))

        # Evaluate potential events
        
        # Event A: Keyword-based impact/success/error
        if matched_cat:
            confidence = 0.6
            if is_exclamation:
                confidence += 0.3
            if is_capitalized:
                confidence += 0.1
            if template_anim in ["caption_pop", "bounce", "zoom"]:
                confidence += 0.1
            
            if confidence >= min_confidence:
                events.append({
                    "event": matched_cat,
                    "time": start_time,
                    "confidence": min(1.0, confidence),
                    "word": text
                })
                continue # Skip adding a general pop for this word if we already matched a strong category

        # Event B: Emoji
        if has_emoji:
            confidence = 0.9
            if confidence >= min_confidence:
                events.append({
                    "event": "emoji",
                    "time": start_time,
                    "confidence": confidence,
                    "word": text
                })
                continue
                
        # Event C: Animation-based (Caption pop, zoom)
        if template_anim:
            # We don't want to pop *every* word, maybe just start of sentences or emphasized words
            confidence = 0.3
            if is_capitalized:
                confidence += 0.3
            if is_exclamation:
                confidence += 0.4
            if is_question:
                confidence += 0.2
            
            if confidence >= min_confidence:
                events.append({
                    "event": template_anim,
                    "time": start_time,
                    "confidence": min(1.0, confidence),
                    "word": text
                })

    return events
