import { usePublishStore, type AIProviderKey } from "./publish-store";
import type { Clip } from "./api";

export interface PlatformMetadata {
  title: string;
  caption: string;
  hashtags: string[];
}

const FALLBACK_TEMPLATES = {
  youtube: {
    title: (hook: string) => `Must Watch: ${hook.substring(0, 50)}!`,
    caption: () => "Subscribe for more amazing content! #shorts #viral",
    hashtags: ["shorts", "viral", "trending"],
  },
  instagram: {
    title: (hook: string) => `${hook.substring(0, 30)}...`,
    caption: (hook: string) => `${hook}\n\nFollow us for more! 🔥\n\n#reels #viral`,
    hashtags: ["reels", "viral", "trending"],
  },
};

async function callOpenRouter(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3-8b-instruct:free", // Default free model or could be configurable
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter API Error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(key: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function tryProviders(prompt: string): Promise<string> {
  const keys = usePublishStore.getState().aiKeys;

  for (const keyObj of keys) {
    try {
      if (keyObj.provider === "openrouter") {
        return await callOpenRouter(keyObj.key, prompt);
      } else if (keyObj.provider === "gemini") {
        return await callGemini(keyObj.key, prompt);
      }
    } catch (error) {
      console.warn(`Provider ${keyObj.provider} failed, trying next...`, error);
      continue;
    }
  }

  throw new Error("All AI providers failed or no keys configured.");
}

export async function generateYouTubeMetadata(clip: Clip): Promise<PlatformMetadata> {
  const hook = clip.hook_text || "Amazing video highlight";
  const prompt = `Generate YouTube Shorts metadata for a clip with this hook/transcript: "${hook}". 
Return ONLY JSON format:
{
  "title": "A catchy SEO title under 100 characters",
  "caption": "A short engaging description",
  "hashtags": ["3 to 5 relevant hashtags without the # symbol"]
}`;

  try {
    const rawResponse = await tryProviders(prompt);
    // basic JSON extraction
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        title: (data.title || FALLBACK_TEMPLATES.youtube.title(hook)).substring(0, 100),
        caption: data.caption || FALLBACK_TEMPLATES.youtube.caption(),
        hashtags: Array.isArray(data.hashtags)
          ? data.hashtags
          : FALLBACK_TEMPLATES.youtube.hashtags,
      };
    }
  } catch (error) {
    console.error("Failed to generate YouTube metadata, using fallback:", error);
  }

  return {
    title: FALLBACK_TEMPLATES.youtube.title(hook),
    caption: FALLBACK_TEMPLATES.youtube.caption(),
    hashtags: FALLBACK_TEMPLATES.youtube.hashtags,
  };
}

export async function generateInstagramMetadata(clip: Clip): Promise<PlatformMetadata> {
  const hook = clip.hook_text || "Amazing reel highlight";
  const prompt = `Generate Instagram Reels metadata for a clip with this hook/transcript: "${hook}". 
Return ONLY JSON format:
{
  "title": "A short title",
  "caption": "A highly engaging caption under 2200 characters. Include emojis.",
  "hashtags": ["5 to 10 relevant hashtags without the # symbol"]
}`;

  try {
    const rawResponse = await tryProviders(prompt);
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        title: data.title || FALLBACK_TEMPLATES.instagram.title(hook),
        caption: (data.caption || FALLBACK_TEMPLATES.instagram.caption(hook)).substring(0, 2200),
        hashtags: Array.isArray(data.hashtags)
          ? data.hashtags
          : FALLBACK_TEMPLATES.instagram.hashtags,
      };
    }
  } catch (error) {
    console.error("Failed to generate Instagram metadata, using fallback:", error);
  }

  return {
    title: FALLBACK_TEMPLATES.instagram.title(hook),
    caption: FALLBACK_TEMPLATES.instagram.caption(hook),
    hashtags: FALLBACK_TEMPLATES.instagram.hashtags,
  };
}
