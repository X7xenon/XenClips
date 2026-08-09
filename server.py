"""
server.py — FastAPI wrapper around pipeline.py:
    download -> transcript (Gemini input) -> viral clips -> raw cut ->
    whisper (real word timestamps) -> Hinglish correction -> subtitles
    (per template, with optional words-per-line / font-size overrides) ->
    render (layout crop + caption burn, per layout x per template)

Run: uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import logging
import uuid
import os
import json
import re
from typing import Literal

import sys
import asyncio
from datetime import datetime
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from pipeline import run_pipeline, MIN_TEMPLATES, MIN_LAYOUTS
from clip_editor import render_raw_clip
from generate_ass import build_ass_from_whisper_words

class WordModel(BaseModel):
    text: str
    start: float
    end: float

class CaptionsUpdate(BaseModel):
    words: list[WordModel]

class GeminiSettingsUpdate(BaseModel):
    keys: list[str]
    limit_per_key: int = 50
    model: str = "gemini-2.5-flash-lite"

class AppSettingsUpdate(BaseModel):
    whatsapp_enabled: bool
    whatsapp_number: str

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

# ----------------- Terminal Log Stream -----------------
log_clients = []
log_queue = None

class WSLogHandler:
    def __init__(self, original_stream):
        self.original_stream = original_stream

    def write(self, message):
        self.original_stream.write(message)
        self.original_stream.flush()
        if log_queue is not None:
            try:
                loop = log_queue._loop
                if not loop.is_closed():
                    loop.call_soon_threadsafe(log_queue.put_nowait, message)
            except Exception:
                pass

    def flush(self):
        self.original_stream.flush()

# Replace stdout and stderr early to capture all prints
sys.stdout = WSLogHandler(sys.stdout)
sys.stderr = WSLogHandler(sys.stderr)
# -------------------------------------------------------

app = FastAPI(title="Shorts Clipper API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

async def log_broadcaster():
    while True:
        try:
            msg = await log_queue.get()
            dead_clients = []
            for client in log_clients:
                try:
                    await client.send_text(msg)
                except Exception:
                    dead_clients.append(client)
            for c in dead_clients:
                if c in log_clients:
                    log_clients.remove(c)
        except Exception as e:
            logger.error(f"Log broadcaster error: {e}")

@app.on_event("startup")
async def startup_event():
    global log_queue
    log_queue = asyncio.Queue()
    asyncio.create_task(log_broadcaster())
    
    from backend.remote.tailscale import start_tailscale_poller
    start_tailscale_poller()
    import whatsapp_notifier
    if whatsapp_notifier.get_settings().get("whatsapp_enabled"):
        whatsapp_notifier.start_bridge()

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    await websocket.accept()
    log_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in log_clients:
            log_clients.remove(websocket)

DB_PATH = "db.json"
if os.path.exists(DB_PATH):
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            _data = json.load(f)
            JOBS = _data.get("JOBS", {})
            CLIPS = _data.get("CLIPS", {})
            PRESETS = _data.get("PRESETS", {})
    except Exception:
        JOBS: dict[str, dict] = {}
        CLIPS: dict[str, dict] = {}
        PRESETS: dict[str, dict] = {}
else:
    JOBS: dict[str, dict] = {}
    CLIPS: dict[str, dict] = {}
    PRESETS: dict[str, dict] = {}

def mark_unfinished_jobs_failed():
    changed = False
    for job_id, job in JOBS.items():
        step = job.get("step", "")
        if step not in ["Done", "Failed", "Cancelled", "Completed"]:
            job["step"] = "Failed"
            job["error"] = "Server restarted during processing"
            changed = True
    if changed:
        save_db()



def save_db():
    try:
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump({"JOBS": JOBS, "CLIPS": CLIPS, "PRESETS": PRESETS}, f)
    except Exception:
        pass

LayoutType = Literal["full_vertical", "bw_letterbox", "blur_bg", "streamer", "original"]
TemplateType = Literal[
    "alex_hormozi", "mrbeast", "iman_gadzhi", "ali_abdaal", "podcast",
    "gaming", "motivational", "minimal_clean", "tiktok_viral", "premium_cinematic",
    "cyberpunk", "hacker", "dreamy", "news_flash", "y2k_bubbly",
    "comic_book", "typewriter", "liquid_glass", "blueprint", "street_graffiti",
    "luxury_marble", "comic_manga", "holographic", "old_newspaper", "blueprint_hud"
]
PositionType = Literal["bottom", "center", "top"]


class ProcessRequest(BaseModel):
    url: str
    layouts: list[LayoutType] = Field(default=["full_vertical"])
    templates: list[TemplateType] = Field(default=["alex_hormozi", "mrbeast", "podcast"])
    position: PositionType = "bottom"
    max_words: int | None = Field(default=None, ge=1, le=10, description="Words shown on screen at once (caption line length). Default is template-specific.")
    font_size: int | None = Field(default=None, ge=20, le=150, description="Caption font size override. Default is template-specific.")
    target_duration: int | None = Field(default=None, description="Target clip length in seconds")
    num_clips: int = Field(default=6, ge=1, le=30, description="Number of clips to generate")
    generate_captions: bool = Field(default=True, description="Whether to generate and burn captions")
    hook_style: str = Field(default="default", description="Global hook text style to apply")
    clip_vibe: str = Field(default="viral", description="AI clip selection vibe")
    hook_vibe: str = Field(default="clickbait", description="AI hook text vibe")
    hook_lang: str = Field(default="auto", description="Hook text language: auto, english, or hinglish")
    creator_name: str | None = Field(default=None, description="Optional creator name to include in hook text")
    sfx_enabled: bool = Field(default=True, description="Whether to add sound effects")
    sfx_volume: int = Field(default=100, ge=0, le=100, description="Master volume for SFX")
    sfx_pack: str = Field(default="default", description="Sound pack to use for SFX")
    fade_enabled: bool = Field(default=True, description="Whether to add video fade in/out")

    @field_validator("layouts")
    @classmethod
    def _min_layouts(cls, v):
        deduped = list(dict.fromkeys(v))
        if len(deduped) < MIN_LAYOUTS:
            raise ValueError(f"Provide at least {MIN_LAYOUTS} layout")
        return deduped

    @field_validator("templates")
    @classmethod
    def _min_templates(cls, v):
        deduped = list(dict.fromkeys(v))
        if len(deduped) < MIN_TEMPLATES:
            raise ValueError(f"Provide at least {MIN_TEMPLATES} distinct templates")
        if len(deduped) > 3:
            raise ValueError(f"Provide at most 3 distinct templates")
        return deduped


class ClipUpdate(BaseModel):
    layout: LayoutType | None = None
    hook_text: str | None = None
    hook_style: str | None = None
    emoji: str | None = None
    position: PositionType | None = None
    font_size: int | None = None
    max_words: int | None = None


def _set_status(job_id: str, step: str, progress: int, error: str | None = None) -> None:
    JOBS[job_id].update(step=step, progress=progress, error=error)
    save_db()
    logger.info("job=%s step=%s progress=%s", job_id, step, progress)


def _run(
    job_id: str, url: str, layouts: list[str], templates: list[str], position: str,
    max_words: int | None, font_size: int | None, target_duration: int | None, num_clips: int, generate_captions: bool,
    hook_style: str, clip_vibe: str, hook_vibe: str, hook_lang: str, creator_name: str | None,
    sfx_enabled: bool, sfx_volume: int, sfx_pack: str, fade_enabled: bool,
    watermark_options: dict | None = None,
) -> None:
    try:
        def progress_cb(step, pct):
            _set_status(job_id, step, pct)

        result = run_pipeline(
            url, layouts=layouts, templates=templates, position=position,
            max_words=max_words, font_size=font_size, target_duration=target_duration,
            num_clips=num_clips,
            generate_captions=generate_captions,
            hook_style=hook_style,
            clip_vibe=clip_vibe,
            hook_vibe=hook_vibe,
            hook_lang=hook_lang,
            creator_name=creator_name,
            sfx_enabled=sfx_enabled,
            sfx_volume=sfx_volume,
            sfx_pack=sfx_pack,
            fade_enabled=fade_enabled,
            watermark_options=watermark_options,
            progress_cb=progress_cb, do_cleanup=False,  # GUI needs raw clips preserved for re-render
        )
        # result["outputs"]: {layout: {template: {clip_number: path_or_None}}}
        # result["ass_path_map"]: {template: {clip_number: ass_path}}  (layout-independent)

        clip_ids = []
        raw_path_by_number = {rec["clip_number"]: rec.get("raw_path") for rec in result["clips"]}
        for rec in result["clips"]:
            clip_number = rec["clip_number"]
            for layout in layouts:
                for template in templates:
                    clip_id = f"{job_id}_clip{clip_number}_{layout}_{template}"
                    out_path = result["outputs"].get(layout, {}).get(template, {}).get(clip_number)
                    ass_path = result.get("ass_path_map", {}).get(template, {}).get(clip_number)

                    CLIPS[clip_id] = {
                        "clip_id": clip_id,
                        "job_id": job_id,
                        "clip_number": clip_number,
                        "raw_path": raw_path_by_number.get(clip_number),
                        "ass_path": ass_path,
                        "video_path": out_path,
                        "duration": (rec.get("end", 0) - rec.get("start", 0)) if rec.get("end") is not None else None,
                        "hook_text": rec.get("hook_text", rec.get("hook", "")),
                        "emoji": rec.get("emoji", ""),
                        "reaction_moment": rec.get("reaction_moment", False),
                        "layout": layout,
                        "template": template,
                        "position": position,
                        "max_words": max_words,
                        "font_size": font_size,
                        "failed": out_path is None,
                        "category": rec.get("category", ""),
                        "segment_type": rec.get("segment_type", "viral"),
                        "emotional_intensity": rec.get("emotional_intensity", 0.0),
                        "emotion_peaks": rec.get("emotion_peaks", []),
                        "sfx_cues": rec.get("sfx_cues", []),
                        "thumbnail_path": rec.get("thumbnail_path"),
                    }
                    clip_ids.append(clip_id)

        JOBS[job_id]["clip_ids"] = clip_ids
        JOBS[job_id]["layouts"] = layouts
        JOBS[job_id]["templates"] = templates
        JOBS[job_id]["workspace"] = result["workspace"]
        _set_status(job_id, "Done", 100)

        # Trigger WhatsApp notification if enabled
        try:
            import whatsapp_notifier
            whatsapp_notifier.send_whatsapp_notification(f"✅ *XenClips Job Complete!*\n\nYour video '{JOBS[job_id].get('source_video', 'Unknown')}' has finished processing.\n{len(clip_ids)} clip variants are ready for review!")
        except Exception as e:
            logger.warning(f"Failed to send WhatsApp notification: {e}")

    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline failed for job=%s", job_id)
        _set_status(job_id, "Failed", JOBS[job_id].get("progress", 0), error=str(exc))


@app.post("/process")
async def process(request: Request, background_tasks: BackgroundTasks):
    content_type = request.headers.get("content-type", "")
    
    url = None
    layouts = ["full_vertical"]
    templates = ["alex_hormozi", "mrbeast", "podcast"]
    position = "bottom"
    max_words = None
    font_size = None
    target_duration = None
    num_clips = 6
    generate_captions = True
    hook_style = "default"
    clip_vibe = "viral"
    hook_vibe = "clickbait"
    hook_lang = "auto"
    creator_name = None
    sfx_enabled = True
    sfx_volume = 100
    sfx_pack = "default"
    fade_enabled = True
    
    body = None
    form = None
    
    if "application/json" in content_type:
        try:
            body = await request.json()
            req = ProcessRequest(**body)
            url = req.url
            layouts = req.layouts
            templates = req.templates
            position = req.position
            max_words = req.max_words
            font_size = req.font_size
            target_duration = req.target_duration
            num_clips = req.num_clips
            generate_captions = req.generate_captions
            hook_style = req.hook_style
            clip_vibe = req.clip_vibe
            hook_vibe = req.hook_vibe
            hook_lang = req.hook_lang
            creator_name = req.creator_name
            sfx_enabled = req.sfx_enabled
            sfx_volume = req.sfx_volume
            sfx_pack = req.sfx_pack
            fade_enabled = req.fade_enabled
        except Exception as e:
            logger.exception("Invalid JSON request to /process")
            raise HTTPException(400, f"Invalid JSON request: {e}")
            
    elif "multipart/form-data" in content_type:
        try:
            form = await request.form()
            
            # Form fields
            position = form.get("position", "bottom")
            
            # layouts & templates can be sent multiple times
            layouts_list = form.getlist("layouts")
            if layouts_list:
                layouts = layouts_list
            
            templates_list = form.getlist("templates")
            if templates_list:
                templates = templates_list
                
            max_words_val = form.get("max_words")
            if max_words_val is not None:
                max_words = int(max_words_val)
                
            font_size_val = form.get("font_size")
            if font_size_val is not None:
                font_size = int(font_size_val)
                
            target_duration_val = form.get("target_duration")
            if target_duration_val is not None:
                target_duration = int(target_duration_val)

            num_clips_val = form.get("num_clips")
            if num_clips_val is not None:
                num_clips = int(num_clips_val)
            
            sfx_enabled_val = form.get("sfx_enabled")
            if sfx_enabled_val is not None:
                sfx_enabled = sfx_enabled_val.lower() == "true"
                
            sfx_volume_val = form.get("sfx_volume")
            if sfx_volume_val is not None:
                sfx_volume = int(sfx_volume_val)
                
            sfx_pack_val = form.get("sfx_pack")
            if sfx_pack_val is not None:
                sfx_pack = sfx_pack_val

            generate_captions_val = form.get("generate_captions")
            if generate_captions_val is not None:
                generate_captions = generate_captions_val.lower() == "true"

            fade_enabled_val = form.get("fade_enabled")
            if fade_enabled_val is not None:
                fade_enabled = fade_enabled_val.lower() == "true"
                
            hook_style_val = form.get("hook_style")
            if hook_style_val is not None:
                hook_style = hook_style_val
                
            clip_vibe_val = form.get("clip_vibe")
            if clip_vibe_val is not None:
                clip_vibe = clip_vibe_val
                
            hook_vibe_val = form.get("hook_vibe")
            if hook_vibe_val is not None:
                hook_vibe = hook_vibe_val
            
            hook_lang_val = form.get("hook_lang")
            if hook_lang_val is not None:
                hook_lang = hook_lang_val

            creator_name_val = form.get("creator_name")
            if creator_name_val is not None:
                creator_name = creator_name_val or None
            
            # The uploaded file
            upload_file = form.get("file")
            if upload_file is not None and hasattr(upload_file, "filename") and upload_file.filename:
                # Save the file to a unique temp file path
                temp_dir = os.path.join("downloads", "_temp")
                os.makedirs(temp_dir, exist_ok=True)
                
                # Use a unique filename to prevent collisions
                file_ext = os.path.splitext(upload_file.filename)[1] or ".mp4"
                unique_name = f"{uuid.uuid4().hex}{file_ext}"
                temp_file_path = os.path.abspath(os.path.join(temp_dir, unique_name))
                
                # Write file content
                content = await upload_file.read()
                with open(temp_file_path, "wb") as f:
                    f.write(content)
                    
                # We can only support single file upload currently
                url = temp_file_path
                logger.info("Saved uploaded file to %s", temp_file_path)
            else:
                url = form.get("url", "").strip()
                
            if not url:
                raise ValueError("No video file or URL provided")
                
        except Exception as e:
            logger.exception("Invalid multipart/form-data request to /process")
            raise HTTPException(400, f"Invalid request data: {e}")
            
    else:
        raise HTTPException(415, "Unsupported media type. Must be application/json or multipart/form-data")

    sz_enabled = False
    if form and form.get("smart_zoom_enabled"): sz_enabled = str(form.get("smart_zoom_enabled")).lower() == "true"
    elif not form and body and "smart_zoom_enabled" in body: sz_enabled = body["smart_zoom_enabled"]
    
    sr_enabled = False
    if form and form.get("speed_ramp_enabled"): sr_enabled = str(form.get("speed_ramp_enabled")).lower() == "true"
    elif not form and body and "speed_ramp_enabled" in body: sr_enabled = body["speed_ramp_enabled"]
    
    wm_enabled = False
    wm_type = "text"
    wm_text = ""
    wm_pos = "bottom_right"
    wm_opacity = 100
    wm_scale = 25
    wm_margin = 20
    wm_anim = "none"
    wm_file = None

    if form:
        if form.get("watermark_enabled"): wm_enabled = str(form.get("watermark_enabled")).lower() == "true"
        if form.get("watermark_type"): wm_type = form.get("watermark_type")
        if form.get("watermark_text"): wm_text = form.get("watermark_text")
        if form.get("watermark_position"): wm_pos = form.get("watermark_position")
        if form.get("watermark_opacity"): wm_opacity = int(form.get("watermark_opacity"))
        if form.get("watermark_scale"): wm_scale = int(form.get("watermark_scale"))
        if form.get("watermark_margin"): wm_margin = int(form.get("watermark_margin"))
        if form.get("watermark_animation"): wm_anim = form.get("watermark_animation")
        
        # Check for watermark file upload
        wm_upload = form.get("watermark_file")
        if wm_upload and hasattr(wm_upload, "filename") and wm_upload.filename:
            temp_dir = os.path.join("downloads", "_temp")
            os.makedirs(temp_dir, exist_ok=True)
            wm_ext = os.path.splitext(wm_upload.filename)[1] or ".png"
            wm_unique = f"wm_{uuid.uuid4().hex}{wm_ext}"
            wm_file = os.path.abspath(os.path.join(temp_dir, wm_unique))
            # Write file content asynchronously since we can't await in a sync block
            # Actually we are in an async function, so we can't just write here directly if it's already read?
            # Wait, we can await wm_upload.read()!
            # Since we are in `async def process(...)`, yes we can await!
    elif body:
        if "watermark_enabled" in body: wm_enabled = body["watermark_enabled"]
        if "watermark_type" in body: wm_type = body["watermark_type"]
        if "watermark_text" in body: wm_text = body["watermark_text"]
        if "watermark_position" in body: wm_pos = body["watermark_position"]
        if "watermark_opacity" in body: wm_opacity = body["watermark_opacity"]
        if "watermark_scale" in body: wm_scale = body["watermark_scale"]
        if "watermark_margin" in body: wm_margin = body["watermark_margin"]
        if "watermark_animation" in body: wm_anim = body["watermark_animation"]

    # Dedup layouts/templates and validate minimum count
    layouts = list(dict.fromkeys(layouts))
    templates = list(dict.fromkeys(templates))
    
    if len(layouts) < MIN_LAYOUTS:
        raise HTTPException(400, f"Provide at least {MIN_LAYOUTS} layout")
    if len(templates) < MIN_TEMPLATES:
        raise HTTPException(400, f"Provide at least {MIN_TEMPLATES} distinct templates")
    if len(templates) > 3:
        raise HTTPException(400, f"Provide at most 3 distinct templates")

    if wm_file and form:
        wm_upload = form.get("watermark_file")
        if wm_upload and hasattr(wm_upload, "read"):
            content = await wm_upload.read()
            with open(wm_file, "wb") as f:
                f.write(content)

    watermark_options = {
        "enabled": wm_enabled,
        "type": wm_type,
        "text": wm_text,
        "position": wm_pos,
        "opacity": wm_opacity,
        "scale": wm_scale,
        "margin": wm_margin,
        "animation": wm_anim,
        "file": wm_file,
    }

    source_video_name = os.path.basename(url) if url else "Unknown"
    job_id = uuid.uuid4().hex[:10]
    JOBS[job_id] = {
        "job_id": job_id, "step": "Fetching Video", "progress": 0, "error": None,
        "clip_ids": [], "layouts": layouts, "templates": templates,
        "source_video": source_video_name,
        "smart_zoom_enabled": sz_enabled,
        "speed_ramp_enabled": sr_enabled,
        "watermark_enabled": wm_enabled,
        "sfx_enabled": sfx_enabled,
        "url": url,
    }
    
    save_db()
    
    background_tasks.add_task(
        _run,
        job_id, url, layouts, templates, position, max_words, font_size,
        target_duration, num_clips, generate_captions, hook_style, clip_vibe, hook_vibe, hook_lang, creator_name, sfx_enabled, sfx_volume, sfx_pack, fade_enabled,
        watermark_options
    )
        
    return {"job_id": job_id, "layouts": layouts, "templates": templates}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job



@app.get("/clips/{job_id}")
def list_clips(job_id: str):
    """Returns all clip variants (one per layout x per template) for this
    job. Group by `clip_number` on the frontend, then sub-group by
    `layout`/`template` to show the full grid of options per source moment."""
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return [CLIPS[cid] for cid in job.get("clip_ids", [])]


@app.get("/clips/{job_id}/{clip_id}")
def get_clip(job_id: str, clip_id: str):
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@app.patch("/clips/{clip_id}")
def update_clip(clip_id: str, update: ClipUpdate):
    """Updates metadata immediately. If layout, font_size, position, or max_words
    changes, re-renders this variant synchronously."""
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")

    rebuild_ass = False
    re_render = False

    if update.hook_text is not None and update.hook_text != clip.get("hook_text"):
        clip["hook_text"] = update.hook_text
        re_render = True
    if update.hook_style is not None and update.hook_style != clip.get("hook_style"):
        clip["hook_style"] = update.hook_style
        re_render = True
    if update.emoji is not None:
        clip["emoji"] = update.emoji

    if update.font_size is not None and update.font_size != clip.get("font_size"):
        clip["font_size"] = update.font_size
        rebuild_ass = True
        re_render = True
    if update.position is not None and update.position != clip.get("position"):
        clip["position"] = update.position
        rebuild_ass = True
        re_render = True
    if update.max_words is not None and update.max_words != clip.get("max_words"):
        clip["max_words"] = update.max_words
        rebuild_ass = True
        re_render = True

    if update.layout and update.layout != clip["layout"]:
        clip["layout"] = update.layout
        re_render = True

    if rebuild_ass:
        ass_path = clip.get("ass_path")
        if not ass_path:
            raise HTTPException(400, "No subtitle path associated with this clip")
            
        clips_dir = os.path.dirname(ass_path)
        clip_number = clip.get("clip_number", 1)
        
        # Load words from JSON cache or fallback
        words_json_path = os.path.join(clips_dir, f"clip_{clip_number}__words.json")
        if os.path.exists(words_json_path):
            try:
                with open(words_json_path, "r", encoding="utf-8") as f:
                    words_list = json.load(f)
            except Exception as e:
                logger.warning("Could not read cached words JSON: %s", e)
                words_list = parse_ass_to_words(ass_path)
        else:
            words_list = parse_ass_to_words(ass_path)
            
        try:
            build_ass_from_whisper_words(
                words_list,
                ass_path,
                template=clip.get("template", "alex_hormozi"),
                position=clip["position"],
                max_words=clip["max_words"],
                font_size=clip["font_size"]
            )
            logger.info("Regenerated ASS path=%s with new overrides", ass_path)
        except Exception as e:
            logger.exception("Failed to build ASS from whisper words")
            raise HTTPException(500, f"Failed to rebuild ASS: {e}")

    if re_render:
        if not clip.get("raw_path") or not os.path.exists(clip["raw_path"]):
            raise HTTPException(
                400,
                "Raw clip no longer available (workspace may have been cleaned up) — can't re-render",
            )
        try:
            render_raw_clip(
                clip["raw_path"], clip["video_path"],
                layout=clip["layout"], ass_path=clip.get("ass_path"), 
                hook_text=clip.get("hook_text"), hook_style=clip.get("hook_style", "default"),
            )
            clip["failed"] = False
        except Exception as exc:  # noqa: BLE001
            logger.exception("Re-render failed for clip=%s", clip_id)
            raise HTTPException(500, f"Re-render failed: {exc}")

    return clip


def parse_ass_to_words(ass_path: str) -> list[dict]:
    if not os.path.exists(ass_path):
        return []
    
    words = []
    
    def to_seconds(t_str: str) -> float:
        parts = t_str.strip().split(":")
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        return 0.0

    try:
        with open(ass_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        logger.warning("Could not read ASS file %s: %s", ass_path, e)
        return []

    for line in lines:
        if not line.startswith("Dialogue:"):
            continue
        
        parts = line.split(",", 9)
        if len(parts) < 10:
            continue
        
        start = to_seconds(parts[1])
        end = to_seconds(parts[2])
        text = parts[9].strip()
        
        # Look for the highlighted word in word mode (contains style or animation tag)
        words_in_line = text.split(" ")
        active_word = None
        for w in words_in_line:
            if "{\\1c" in w or "{\\fsc" in w or "{\\alpha" in w or "{\\blur" in w:
                active_word = re.sub(r"\{.*?\}", "", w).strip()
                break
        
        if active_word:
            words.append({"text": active_word, "start": start, "end": end})
        else:
            cleaned = re.sub(r"\{.*?\}", "", text).strip()
            split_words = cleaned.split()
            if split_words:
                dur = (end - start) / len(split_words)
                for idx, sw in enumerate(split_words):
                    words.append({"text": sw, "start": start + idx * dur, "end": start + (idx + 1) * dur})
                    
    return words


@app.get("/clips/{clip_id}/captions")
def get_clip_captions(clip_id: str):
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    
    ass_path = clip.get("ass_path")
    if not ass_path:
        return []
    
    clips_dir = os.path.dirname(ass_path)
    clip_number = clip.get("clip_number", 1)
    
    # Try loading cached JSON first
    words_json_path = os.path.join(clips_dir, f"clip_{clip_number}__words.json")
    if os.path.exists(words_json_path):
        try:
            with open(words_json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("Failed to load words JSON: %s, falling back to ASS", e)

    # Fallback to parsing the ASS file
    return parse_ass_to_words(ass_path)


@app.post("/clips/{clip_id}/captions")
def update_clip_captions(clip_id: str, update: CaptionsUpdate):
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    
    ass_path = clip.get("ass_path")
    if not ass_path:
        raise HTTPException(400, "No subtitles associated with this clip")
    
    clips_dir = os.path.dirname(ass_path)
    clip_number = clip.get("clip_number", 1)
    
    # Save the updated words to the JSON file
    words_json_path = os.path.join(clips_dir, f"clip_{clip_number}__words.json")
    words_list = [{"text": w.text, "start": w.start, "end": w.end} for w in update.words]
    try:
        with open(words_json_path, "w", encoding="utf-8") as f:
            json.dump(words_list, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.exception("Failed to write updated words JSON")
        raise HTTPException(500, f"Failed to save caption updates: {e}")

    # Regenerate all ASS files matching clip_{clip_number}__*.ass in the directory
    regenerated_count = 0
    try:
        for filename in os.listdir(clips_dir):
            if filename.startswith(f"clip_{clip_number}__") and filename.endswith(".ass"):
                template_part = filename[len(f"clip_{clip_number}__"):-4]
                target_ass_path = os.path.join(clips_dir, filename)
                build_ass_from_whisper_words(
                    words_list,
                    target_ass_path,
                    template=template_part,
                    position=clip.get("position", "bottom"),
                    max_words=clip.get("max_words"),
                    font_size=clip.get("font_size")
                )
                regenerated_count += 1
    except Exception as e:
        logger.exception("Failed to regenerate subtitle files")
        raise HTTPException(500, f"Failed to regenerate subtitle files: {e}")

    return {"status": "updated", "regenerated_templates_count": regenerated_count}


@app.post("/clips/{clip_id}/export")
def export_clip(clip_id: str):
    """Re-renders this variant with current hook_text/layout baked in.
    NOTE: emoji is metadata only — no overlay filter wired yet."""
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    if not clip.get("raw_path"):
        raise HTTPException(
            400,
            "Raw clip no longer available (workspace may have been cleaned up) — can't re-render",
        )

    try:
        render_raw_clip(
            clip["raw_path"], clip["video_path"],
            layout=clip["layout"], ass_path=clip.get("ass_path"), 
            hook_text=clip.get("hook_text"), hook_style=clip.get("hook_style", "default"),
        )
        clip["failed"] = False
    except Exception as exc:  # noqa: BLE001
        logger.exception("Export failed for clip=%s", clip_id)
        raise HTTPException(500, f"Export failed: {exc}")

    return {"status": "done", "video_path": clip["video_path"]}


@app.post("/jobs/{job_id}/cleanup")
def cleanup_job(job_id: str):
    """
    Deletes this job's input/ and temp/ (raw clips) to free disk space.
    GUI mode never auto-cleans (unlike main.py's CLI flow) since re-render
    (layout switch / export) needs the raw clips — call this manually once
    you're happy with the final clips and don't need to re-render anymore.
    IRREVERSIBLE: after this, layout switches / re-exports on this job's
    clips will fail with "raw clip no longer available".
    """
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    workspace = job.get("workspace")
    if not workspace:
        raise HTTPException(400, "Job has no workspace recorded (not finished yet?)")

    from clip_cutter import cleanup_workspace
    removed = cleanup_workspace(workspace)
    return {"status": "cleaned", "removed": removed}

@app.get("/thumbnail/{clip_id}")
def get_thumbnail(clip_id: str):
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    thumb = clip.get("thumbnail_path")
    if not thumb or not os.path.exists(thumb):
        raise HTTPException(404, "Thumbnail not available")
    return FileResponse(thumb, media_type="image/jpeg")

@app.get("/clips/{clip_id}/srt")
def get_srt(clip_id: str):
    clip = CLIPS.get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    ass_path = clip.get("ass_path")
    if not ass_path or not os.path.exists(ass_path):
        raise HTTPException(404, "Subtitles not available")
    import srt_exporter
    import tempfile
    
    srt_out = os.path.join(tempfile.gettempdir(), f"{clip_id}.srt")
    try:
        srt_exporter.ass_to_srt(ass_path, srt_out)
        return FileResponse(srt_out, media_type="text/plain", filename=f"{clip_id}.srt")
    except Exception as e:
        logger.exception("Failed to export SRT")
        raise HTTPException(500, f"SRT generation failed: {e}")

# Trigger Uvicorn reload to bind the newly installed python-multipart library.

@app.get("/gemini-settings")
def get_gemini_settings():
    import gemini_usage
    return gemini_usage.get_keys_status()

@app.post("/gemini-settings")
def update_gemini_settings(update: GeminiSettingsUpdate):
    import gemini_usage
    gemini_usage.set_keys_settings(update.keys, update.limit_per_key, update.model)
    return {"status": "ok"}

@app.get("/app-settings")
def get_app_settings():
    import whatsapp_notifier
    return whatsapp_notifier.get_settings()

@app.post("/app-settings")
def update_app_settings(update: AppSettingsUpdate):
    import whatsapp_notifier
    whatsapp_notifier.save_settings({
        "whatsapp_enabled": update.whatsapp_enabled,
        "whatsapp_number": update.whatsapp_number
    })
    if update.whatsapp_enabled:
        whatsapp_notifier.start_bridge()
    else:
        whatsapp_notifier.stop_bridge()
    return {"status": "ok"}

@app.get("/whatsapp/status")
def get_whatsapp_status():
    import requests
    try:
        res = requests.get("http://localhost:3001/status", timeout=5)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        logger.error(f"WhatsApp status error: {e}")
        return {"connected": False, "error": str(e)}

@app.get("/whatsapp/qr")
def get_whatsapp_qr():
    import requests
    try:
        res = requests.get("http://localhost:3001/qr", timeout=15)
        res.raise_for_status()
        return res.json()
    except Exception as e:
        logger.error(f"WhatsApp QR error: {e}")
        return {"connected": False, "qr": None, "error": str(e)}

@app.post("/whatsapp/test")
def test_whatsapp():
    import whatsapp_notifier
    success = whatsapp_notifier.send_whatsapp_notification("🤖 Hello! This is a test message from XenClips to verify your WhatsApp authentication.")
    if success:
        return {"status": "ok"}
    else:
        raise HTTPException(500, "Failed to send test message. Make sure the number is configured and the bridge is connected.")

@app.get("/jobs")
def get_jobs():
    return list(JOBS.values())

@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    if job_id in JOBS:
        JOBS[job_id]["step"] = "Cancelled"
        save_db()
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Job not found")

@app.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    if job_id in JOBS:
        del JOBS[job_id]
        save_db()
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Job not found")

class PresetUpdate(BaseModel):
    preset_id: str
    data: dict

@app.get("/presets")
def get_presets():
    return PRESETS

@app.post("/presets")
def save_preset(update: PresetUpdate):
    PRESETS[update.preset_id] = update.data
    save_db()
    return {"status": "ok"}

@app.delete("/presets/{preset_id}")
def delete_preset(preset_id: str):
    if preset_id in PRESETS:
        del PRESETS[preset_id]
        save_db()
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Preset not found")

@app.post("/shutdown")
def shutdown_app():
    import subprocess
    import threading
    def _kill():
        import time
        time.sleep(1)
        # Kill the windows by their specific titles
        subprocess.run('taskkill /FI "WINDOWTITLE eq Xenclips Frontend*" /T /F', shell=True)
        subprocess.run('taskkill /FI "WINDOWTITLE eq WhatsApp Bridge*" /T /F', shell=True)
        subprocess.run('taskkill /FI "WINDOWTITLE eq Xenclips Backend*" /T /F', shell=True)
    
    threading.Thread(target=_kill).start()
    return {"status": "Shutting down"}

from backend.remote.service import router as remote_router
app.include_router(remote_router, prefix="/api/remote", tags=["remote"])
