# config.py — central place for all shared settings
import os

# ─────────────────────────────────────────────────────────────
# Gemini
# ─────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")

# gemini-2.5-flash-lite  → fastest, cheapest, free-tier friendly
# gemini-2.5-flash       → smarter, still fast
GEMINI_MODEL = "gemini-2.5-flash-lite"

# ─────────────────────────────────────────────────────────────
# Downloader
# ─────────────────────────────────────────────────────────────
MIN_QUALITY = 720          # minimum video height in px

# ─────────────────────────────────────────────────────────────
# Clip editor
# ─────────────────────────────────────────────────────────────
DEFAULT_ASPECT       = "original"   # original | 9:16 | 1:1 | 4:5
WORDS_PER_CAPTION    = 6
NORMALIZE_AUDIO      = True
FADE_IN              = 0.3
FADE_OUT             = 0.3
