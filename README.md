<div align="center">

# ✂️ XenClips Studio

**The Ultimate Self-Hosted AI Video Clipping Suite**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

**XenClips Studio** is a completely self-hosted, full-stack video automation engine designed to effortlessly convert long-form YouTube videos, podcasts, and streams into highly engaging, viral short-form clips (TikToks, Shorts, Reels) entirely on your own hardware. 

Featuring an incredibly sleek, real-time local web dashboard, XenClips orchestrates a heavy-duty AI pipeline under the hood—combining the best of local and cloud models to achieve professional-grade results.

## ✨ Features

- **🌐 Sleek Web Dashboard**: A modern, dark-mode glassmorphic interface built with React, Vite, and TanStack Router to manage jobs, preview templates, and configure processing visually.
- **🧠 Intelligent Viral Detection**: Uses **Google Gemini 2.5 Flash** (with **NVIDIA Nemotron 3 Ultra / 4** fallback) to deeply analyze transcripts and find high-retention, high-emotion moments.
- **🎙️ State-of-the-art Transcription**: Employs **Whisper** for rapid, accurate audio transcription.
- **✍️ Hinglish Smart Correction**: A local **Qwen** model (via Ollama) intelligently corrects Hinglish, slang, and code-switched phrases instantly while preserving timestamps.
- **🎯 Dynamic Face Tracking (Auto-Crop)**: Utilizes **YOLOv8** to track faces smoothly and dynamically crop horizontal videos to vertical 9:16 aspect ratios.
- **🎵 Automated SFX & Mixing**: Predicts emotional peaks and intelligently places sound effects (whooshes, dings, dramatic hits) on key cut points and punchlines.
- **🎬 Professional Subtitles**: Generates complex `.ass` and `.srt` caption templates with word-by-word highlights, animations, and emojis—just like top-tier editors.

## 🏗️ Architecture overview

XenClips is split into two main components:
1. **Python Backend**: A robust FastAPI server (`server.py`) handling a state-machine queue (Downloader → Transcriber → AI Clip Selector → Cropper → SFX Mixer → Caption Renderer).
2. **React Frontend**: A modern web client (`/xenclips`) providing the graphical user interface.

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & npm (or Bun)
- **FFmpeg** (Must be installed and in your system PATH)
- **Ollama** (Optional but recommended for local Hinglish spelling correction. Requires `qwen2.5` model pulled).
- API Keys: 
  - **Gemini API Key** (Configured via the web interface)
  - **NVIDIA API Key** (For Nemotron fallback)

### 1. Setup Backend (Python)

Clone the repository and install Python dependencies:

```bash
git clone https://github.com/X7xenon/XenClips.git
cd XenClips
pip install -r requirements.txt
```
*(Make sure to create your `requirements.txt` with FastAPI, Uvicorn, google-genai, openai, yt-dlp, ultralytics, etc.)*

### 📥 2. Download AI Models (Important!)
Because AI models are too large for GitHub, you must download them manually into your project directory before running the app.

1. **YOLOv8 Auto-Cropping Model (`yolov8n.pt`)**:
   - Download the model from the official ultralytics release or let the app auto-download it on first run (if internet is available).
   - Place `yolov8n.pt` in the root folder `XenClips/`.

2. **Whisper / Alignment Model (`model/model.bin`)**:
   - If using local Whisper, ensure your `.bin` files and configuration (`config.json`, `tokenizer.json`, etc.) are placed inside the `model/` folder.
   - *Note: These files can often be over 1.5GB.*

### 3. Start Backend Server

Start the backend API server:

```bash
uvicorn server:app --reload --port 8000
```

### 2. Setup Frontend (React/Vite)

Open a new terminal and navigate to the frontend directory:

```bash
cd xenclips
npm install
npm run dev
```

Your web dashboard will now be running on `http://localhost:5173`.

---

## 🛠️ Usage

1. Open the **XenClips Studio** in your browser.
2. Enter a YouTube URL (or upload a local file).
3. Select your desired caption styles, layout templates, and click **Synthesize Engine**.
4. The backend will sequentially download the video, transcribe it, find the best clips, crop the faces, mix SFX, and render the final MP4s!
5. Navigate to the **Clips** tab to preview and export your final videos.

## 🤝 Contributing
Contributions are highly welcome! Whether it's adding new caption templates, optimizing the face-tracking logic, or enhancing the frontend UI—feel free to fork this project and submit a Pull Request.

## 📜 License
MIT License. See `LICENSE` for details.
