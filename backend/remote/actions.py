import os
import subprocess
import threading
import time
import logging

logger = logging.getLogger(__name__)

def execute_remote_action(action: str):
    logger.info(f"Executing remote action: {action}")
    
    def kill_port(port):
        try:
            output = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True).decode()
            for line in output.strip().split('\n'):
                if 'LISTENING' in line:
                    pid = line.strip().split()[-1]
                    subprocess.Popen(f'taskkill /F /PID {pid} /T', shell=True)
        except Exception:
            pass

    if action == "restart-backend":
        def kill_self():
            time.sleep(1)
            kill_port(8000)
            os.system('taskkill /FI "WINDOWTITLE eq FastAPI Backend*" /T /F')
            os._exit(0)
        threading.Thread(target=kill_self).start()
        return {"status": "Backend is restarting"}
        
    elif action == "restart-frontend":
        # Usually vite runs on 5173 or 8080 depending on the project
        kill_port(5173)
        kill_port(8080)
        os.system('taskkill /FI "WINDOWTITLE eq Xenclips Frontend*" /T /F')
        return {"status": "Frontend process killed (Restart manually via terminal)"}
        
    elif action == "shutdown-pc":
        os.system('shutdown /s /t 5')
        return {"status": "PC shutting down in 5 seconds"}
        
    elif action == "clear-temp":
        temp_dir = os.path.join(os.environ.get("TEMP", "C:/Windows/Temp"))
        try:
            subprocess.Popen(f'del /q /f /s "{temp_dir}\\*"', shell=True)
            return {"status": "Temp files clearing in background"}
        except Exception as e:
            return {"error": str(e)}
            
    elif action == "pause-queue":
        return {"status": "Queue paused (mock: feature requires queue manager update)"}
        
    elif action == "resume-queue":
        return {"status": "Queue resumed (mock: feature requires queue manager update)"}
        
    elif action == "cancel-job":
        import json
        DB_PATH = "db.json"
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            changed = False
            for j_id, j in data.get("JOBS", {}).items():
                if j.get("step") not in ["Done", "Failed", "Cancelled", "Completed"]:
                    j["step"] = "Cancelled"
                    changed = True
            if changed:
                with open(DB_PATH, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            return {"status": "Cancelled all active jobs" if changed else "No active jobs to cancel"}
        except Exception as e:
            return {"error": str(e)}

    return {"error": f"Unknown action: {action}"}
