@echo off
if not DEFINED IS_MINIMIZED set IS_MINIMIZED=1 && start "" /min "%~dpnx0" %* && exit
start /min "Xenclips Backend" cmd /c "cd /d "%~dp0" && uvicorn server:app --reload --host 0.0.0.0 --port 8000"
start /min "Xenclips Frontend" cmd /c "cd /d "%~dp0xenclips" && npm run dev -- --host"
timeout /t 3 /nobreak > nul
start http://localhost:8080
exit
