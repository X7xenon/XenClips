import os
import subprocess

def apply_watermark(input_mp4: str, output_mp4: str, options: dict) -> bool:
    """
    Applies a watermark to the video using ffmpeg.
    Returns True if successful, False otherwise.
    
    options = {
        "type": "png" | "svg" | "text" | "logo_text",
        "text": str,
        "position": "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center",
        "opacity": int (0-100),
        "scale": int (0-100),
        "margin": int (0-100),
        "animation": "none" | "fade_in" | "fade_out" | "slide_in",
        "file": str (path to logo image if type is png/svg/logo_text)
    }
    """
    if not options:
        return False
        
    opacity = options.get("opacity", 100) / 100.0
    scale = options.get("scale", 25) / 100.0
    margin = options.get("margin", 20)
    pos = options.get("position", "bottom_right")
    wm_type = options.get("type", "text")
    text = options.get("text", "")
    logo_file = options.get("file")
    
    # Position logic
    if pos == "top_left":
        overlay_pos = f"{margin}:{margin}"
    elif pos == "top_right":
        overlay_pos = f"main_w-overlay_w-{margin}:{margin}"
    elif pos == "bottom_left":
        overlay_pos = f"{margin}:main_h-overlay_h-{margin}"
    elif pos == "center":
        overlay_pos = f"(main_w-overlay_w)/2:(main_h-overlay_h)/2"
    else: # bottom_right
        overlay_pos = f"main_w-overlay_w-{margin}:main_h-overlay_h-{margin}"
        
    filter_complex = []
    
    # If text, we could use drawtext, but standardizing via overlay is easier if we have an image
    # For now, we'll construct the ffmpeg command based on whether we have an image or just text.
    cmd = ["ffmpeg", "-y", "-i", input_mp4]
    
    if wm_type in ("png", "svg", "logo_text") and logo_file and os.path.exists(logo_file):
        cmd.extend(["-i", logo_file])
        
        # Scale and opacity for image
        img_filter = f"[1:v]scale=iw*{scale}:-1,format=rgba,colorchannelmixer=aa={opacity}[wm];"
        
        # Overlay
        overlay_filter = f"[0:v][wm]overlay={overlay_pos}[outv]"
        
        # Add animation if requested (simple fade in for now as an example)
        anim = options.get("animation", "none")
        if anim == "fade_in":
            # fade in over 1 second
            overlay_filter = f"[0:v][wm]overlay={overlay_pos}:enable='gte(t,0)':alpha='if(lt(t,1),t,1)'[outv]"
            # FFMPEG overlay doesn't support alpha fading natively without complex graph, 
            # so we'll just use the standard overlay and rely on a basic fade filter on the watermark.
            img_filter = f"[1:v]scale=iw*{scale}:-1,format=rgba,colorchannelmixer=aa={opacity},fade=in:st=0:d=1:alpha=1[wm];"
            overlay_filter = f"[0:v][wm]overlay={overlay_pos}[outv]"
            
        filter_complex.append(img_filter + overlay_filter)
        
    elif wm_type == "text" and text:
        # Use drawtext
        # drawtext doesn't support opacity easily without color=white@0.5
        # We'll map opacity 0-100 to hex 00-FF
        alpha_hex = hex(int(opacity * 255))[2:].upper().zfill(2)
        fontcolor = f"white@{opacity}"
        
        # Position mapping for drawtext
        if pos == "top_left":
            dt_pos = f"x={margin}:y={margin}"
        elif pos == "top_right":
            dt_pos = f"x=w-tw-{margin}:y={margin}"
        elif pos == "bottom_left":
            dt_pos = f"x={margin}:y=h-th-{margin}"
        elif pos == "center":
            dt_pos = f"x=(w-tw)/2:y=(h-th)/2"
        else: # bottom_right
            dt_pos = f"x=w-tw-{margin}:y=h-th-{margin}"
            
        dt_filter = f"drawtext=text='{text}':fontcolor={fontcolor}:fontsize=min(w\\,h)*{scale}:shadowcolor=black@0.5:shadowx=2:shadowy=2:{dt_pos}[outv]"
        filter_complex.append(f"[0:v]{dt_filter}")
    else:
        # Nothing to do
        return False
        
    cmd.extend([
        "-filter_complex", "".join(filter_complex),
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:a", "copy",
        "-c:v", "libx264",
        "-preset", "fast",
        output_mp4
    ])
    
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print(f"Watermark failed: {result.stderr}")
        return False
        
    return True
