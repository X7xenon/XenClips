import os
import json
import re
import time

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ==========================
# CONFIG
# ==========================

import gemini_usage

# MODEL = "gemini-2.5-flash" (Now managed dynamically via gemini_usage)


# ==========================
# LOAD TRANSCRIPT
# ==========================

def load_transcript(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def transcript_to_text(transcript):
    lines = []

    for item in transcript:
        t = int(item["start"])
        h = t // 3600
        m = (t % 3600) // 60
        s = t % 60

        timestamp = f"{h:02d}:{m:02d}:{s:02d}"

        lines.append(f"[{timestamp}] {item['text']}")

    return "\n".join(lines)


# ==========================
# PROMPT
# ==========================

def build_prompt(text, target_duration=None, num_clips=6, clip_vibe="viral", hook_vibe="clickbait"):
    duration_rule = ""
    if target_duration:
        duration_rule = f"- Each clip should be close to {target_duration} seconds (±10s tolerance)\n"
    else:
        duration_rule = "- Each clip must be 50–80 seconds\n"

    return f"""
You are an elite, world-class YouTube Shorts & TikTok editor and retention strategist.

CRITICAL DIRECTIVE: You MUST read and analyze the ENTIRE transcript from start to finish before selecting clips. Do not just pick moments from the beginning. Many of the most viral, high-retention moments happen in the middle or at the end. Analyze the full narrative arc and context.

Task:
1. READ THE ENTIRE TRANSCRIPT. You must write a "video_analysis" mapping out the timeline from start to finish, explicitly highlighting high-retention moments found in the middle and end of the video.
2. Determine the CATEGORY of this video content (e.g. podcast, comedy, interview, motivation).
3. Deeply analyze the full transcript to find the absolute strongest, most viral moments.
4. For each clip, analyze the emotional intensity and suggest sound effect cue points.

Rules:
- Extract EXACTLY {num_clips} viral clips. Not more, not less.
{duration_rule}- No overlap between clips
- Focus ONLY on elite, high-retention moments that will hook viewers in the first 3 seconds and keep them watching until the end.
- Classify each clip's segment type: "viral" (default), "qa" (clear question+answer), "chapter_boundary" (topic shift), "product_mention" (brand/product named)
- CRITICAL: If the transcript is in Hindi or Hinglish, you MUST write the "hook_text" in Hinglish (Roman script Hindi) instead of English.

Prioritize (in order of viral potential) based on the "{clip_vibe}" vibe:
- If "funny": Look for jokes, humorous situations, hilarious reactions, and comedic timing.
- If "serious": Look for deep insights, intense discussions, emotional vulnerability, and raw truth.
- If "aura farm": Look for extreme hype, sigma male energy, undeniable confidence, and epic flexes.
- If "educational": Look for valuable facts, step-by-step tutorials, mind-blowing knowledge, and practical advice.
- Otherwise (viral): Look for shocking moments, plot twists, intense motivational peaks, and massive attention grabbers.

When generating "hook_text", adapt the tone to be "{hook_vibe}". ALWAYS include a highly engaging emoji (or two) relevant to the topic (e.g., "Wait for it 🤯").
Here are 15 hook text templates to draw inspiration from. Pick the one that fits best or create your own in this style:
1. "You won't believe this 🤯"
2. "The harsh truth about [Topic] 🛑"
3. "Wait until the end 😱"
4. "Nobody is talking about this 🤫"
5. "The biggest lie we've been told 🚫"
6. "How to actually [Goal] 🧠"
7. "This changes everything 🤯"
8. "I can't believe he said that 😳"
9. "The secret to [Topic] 🔑"
10. "Stop doing this immediately ❌"
11. "This will blow your mind 🤯"
12. "The reality of [Topic] 📉"
13. "Genius or crazy? 🤔"
14. "Watch this before you [Action] ⚠️"
15. "The unspoken rule of [Topic] 📖"

For SFX cues, suggest 0-5 sound effect trigger points per clip. Use these types:
- "whoosh" — on fast cuts, transitions, or emphasis
- "ding" — on key numbers, reveals, or important points
- "dramatic_hit" — on punchlines, shocking reveals, or climaxes
- "reaction" — on funny/surprising moments
- "pop" — on quick visual emphasis
- "laugh" — on genuinely funny moments
- "ui_click" — on UI elements, mouse clicks, data changes, selections
- "typing" — on typing or text appearing
- "camera" — on photos, zooming, or shutter sounds
- "riser" — building tension before a drop or reveal
- "mechanical" — on mechanical actions, gears, weapons
- "glitch" — on errors, static, or cyber-style visuals
- "hum" — on futuristic or continuous suspense moments
- "clock" — on ticking clocks or running out of time

Return ONLY a valid JSON object. No markdown fences, no explanation, no intro text.

Format:

{{
  "video_analysis": "I have scanned the entire video from start to finish. In the first 10 minutes... In the middle... At the end, the most viral moment is...",
  "clips": [
    {{
    "title": "",
    "hook": "",
    "hook_text": "",
    "start": 0,
    "end": 0,
    "duration": 0,
    "viral_score": 0,
    "reason": "",
    "category": "podcast",
    "segment_type": "viral",
    "topic": "",
    "product_mentions": [],
    "emotional_intensity": 0.0,
    "sfx_cues": [
      {{"time_offset": 2.4, "type": "whoosh"}},
      {{"time_offset": 12.1, "type": "ding"}}
    ]
    }}
  ]
}}

IMPORTANT:
- "category" should be the SAME for all clips (it describes the source video, not individual clips)
- "viral_score" should be an honest assessment out of 100 based on modern short-form retention metrics.
- "emotional_intensity" is a float 0.0–1.0 (0 = calm talking, 1 = screaming/crying/peak emotion)
- "sfx_cues" time_offset is RELATIVE to clip start (0 = beginning of clip)
- "hook_text" is the attention-grabbing opening line viewers see first, and MUST include an emoji.

Transcript (Read ENTIRELY before answering):
{{text}}
"""


# ==========================
# GEMINI CALL
# ==========================

def ask_nemotron(prompt):
    from openai import OpenAI
    client = OpenAI(
      base_url = "https://integrate.api.nvidia.com/v1",
      api_key = os.getenv("NVIDIA_API_KEY", "YOUR_NVIDIA_API_KEY")
    )
    completion = client.chat.completions.create(
      model="nvidia/nemotron-3-ultra-550b-a55b",
      messages=[{"role":"user","content":prompt}],
      temperature=1,
      top_p=0.95,
      max_tokens=16384,
      extra_body={"chat_template_kwargs":{"enable_thinking":True},"reasoning_budget":16384}
    )
    return completion.choices[0].message.content

def ask_gemini(prompt):
    api_key = gemini_usage.get_available_key()
    client = genai.Client(api_key=api_key)
    
    current_model = gemini_usage.get_model()
    
    response = client.models.generate_content(
        model=current_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3
        ),
    )
    
    # Increment usage on successful call
    gemini_usage.increment_usage(api_key)
    
    return response.text


# ==========================
# PARSE JSON
# ==========================

def extract_json(text):
    text = text.strip()
    text = text.replace("```json", "").replace("```", "")

    # Try to find a JSON object first (new format with video_analysis)
    match_obj = re.search(r"\{.*\}", text, re.DOTALL)
    if match_obj:
        try:
            data = json.loads(match_obj.group())
            if "clips" in data:
                return data["clips"]
        except Exception:
            pass

    # Fallback to finding just an array (old format)
    match_arr = re.search(r"\[.*\]", text, re.DOTALL)
    if not match_arr:
        raise ValueError("Invalid JSON from Gemini")

    return json.loads(match_arr.group())


# ==========================
# MAIN FUNCTION
# ==========================

def generate_viral_clips(transcript_path, target_duration=None, num_clips=6, clip_vibe="viral", hook_vibe="clickbait"):
    transcript = load_transcript(transcript_path)
    text = transcript_to_text(transcript)

    prompt = build_prompt(text, target_duration=target_duration, num_clips=num_clips, clip_vibe=clip_vibe, hook_vibe=hook_vibe)

    print("\nAnalyzing transcript for viral moments...\n")

    for attempt in range(3):
        try:
            print(f"Attempt {attempt+1} - Trying Gemini...")
            response = ask_gemini(prompt)
            clips = extract_json(response)
            clips = clips[:num_clips]
            print(f"\nFound {len(clips)} viral clips using Gemini\n")
            return clips
        except Exception as e:
            print(f"Gemini failed ({e}), falling back to NVIDIA Nemotron...")
            try:
                response = ask_nemotron(prompt)
                clips = extract_json(response)
                clips = clips[:num_clips]
                print(f"\nFound {len(clips)} viral clips using Nemotron\n")
                return clips
            except Exception as nemotron_e:
                print("Nemotron retry failed:", nemotron_e)
                time.sleep(2)

    raise Exception("Failed to generate clips using both Gemini and Nemotron")


# ==========================
# SAVE OUTPUT
# ==========================

def save_clips(clips, workspace):

    # correct folder structure
    clips_dir = os.path.join(workspace, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    output_path = os.path.join(clips_dir, "clips.json")

    data = {
        "total_clips": len(clips),
        "clips": clips
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\nSaved clips at:", output_path)

    return output_path
# ==========================
# RUN
# ==========================

if __name__ == "__main__":

    path = input("Transcript JSON Path: ").strip()

    clips = generate_viral_clips(path)

    save_clips(clips, os.path.dirname(path))

    print("\nDONE 🚀")