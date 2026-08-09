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

Featuring an incredibly sleek, real-time local web dashboard, XenClips orchestrates a heavy-duty AI pipeline under the hood—combining the best of local models to achieve professional-grade results.

## ✨ Features

- **🌐 Sleek Web Dashboard**: A modern, dark-mode glassmorphic interface built with React, Vite, and TanStack Router to manage jobs, preview templates, and configure processing visually.
- **🧠 Intelligent Viral Detection**: Uses **Google Gemini 2.5 Flash** (with **NVIDIA Nemotron 3 Ultra / 4** fallback) to deeply analyze transcripts and find high-retention, high-emotion moments.
- **🎙️ State-of-the-art Transcription**: Employs **Faster-Whisper large-v3-turbo** for rapid, accurate audio transcription and precise word-level timestamps.
- **✍️ Hinglish Smart Correction**: A local **Qwen** model (via Ollama) intelligently corrects Hinglish, slang, and code-switched phrases instantly while preserving timestamps.
- **🎯 Dynamic Cropping**: Automatically handles smart center-cropping to perfectly fit horizontal videos into vertical 9:16 aspect ratios.
- **🎬 Professional Subtitles**: Generates complex `.ass` and `.srt` caption templates with word-by-word highlights, animations, and emojis—just like top-tier editors.
- **⏱️ Real-time Processing Estimates**: Advanced ETA widget that tracks processing times for downloading, transcription, clip selection, and rendering steps.

## 🏗️ Architecture overview

XenClips is split into two main components:
1. **Python Backend**: A robust FastAPI server (`server.py`) handling a state-machine queue (Downloader → Transcriber → AI Clip Selector → Cropper → Caption Renderer).
2. **React Frontend**: A modern web client (`/xenclips`) providing the graphical user interface.

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & npm (or Bun)
- **FFmpeg** (Must be installed and in your system PATH)
- **Ollama** (Optional but recommended for local Hinglish spelling correction. Requires `qwen2.5` model pulled).
- API Keys: 
  - **Gemini API Key** (Configured via the web interface Settings tab)
  - **NVIDIA API Key** (For Nemotron fallback)

### 1. Setup Backend (Python)

Clone the repository and install Python dependencies:

```bash
git clone https://github.com/X7xenon/XenClips.git
cd XenClips
pip install -r requirements.txt
```

### 📥 2. Download AI Models (Important!)
Because AI models are too large for GitHub, you must download them manually into your project directory before running the app.

1. **Whisper / Alignment Model (`model/`)**:
   - We use the `large-v3-turbo` model for insanely fast and accurate transcription. 
   - Download the model files directly from HuggingFace: [openai/whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo)
   - Ensure the downloaded `.bin` files and configuration (`config.json`, `tokenizer.json`, etc.) are placed inside the `model/` folder in the root directory.

### 3. Start Backend Server

Start the backend API server:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

### 4. Setup Frontend (React/Vite)

Open a new terminal and navigate to the frontend directory:

```bash
cd xenclips
npm install
npm run dev
```

Your web dashboard will now be running on `http://localhost:8080` (enforced by Vite).

---

## 🛠️ Usage

1. Open the **XenClips Studio** in your browser at `http://localhost:8080`.
2. Follow the **Guide** tab to input your free Gemini API key in Settings.
3. In the **Upload** tab, enter a YouTube URL (or upload a local file).
4. Select your desired caption styles, layout templates, and click **Synthesize Engine**.
5. The backend will sequentially download the video, transcribe it, find the best clips, crop the faces, and render the final MP4s!
6. Jump over to the **Clips** tab to preview, tweak metadata, and export your final videos!

## 🤝 Contributing
Contributions are highly welcome! Whether it's adding new caption templates, optimizing the face-tracking logic, or enhancing the frontend UI—feel free to fork this project and submit a Pull Request.

## 📜 License
MIT License. See `LICENSE` for details.
