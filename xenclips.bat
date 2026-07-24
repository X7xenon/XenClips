@echo off
echo =========================================
echo Starting Xenclips Backend and Frontend...
echo =========================================

:: Start the Python backend in a new command window
echo Starting FastAPI Backend (uvicorn)...
start "Xenclips Backend" cmd /k "cd /d X:\Millionaire\Shorts_automation_v2 && uvicorn server:app --reload --port 8000"

:: Start the frontend in a new command window
echo Starting Frontend (bun dev)...
start "Xenclips Frontend" cmd /k "cd /d X:\Millionaire\Shorts_automation_v2\xenclips && npm run dev"

echo Done! Both servers are starting in new windows.
