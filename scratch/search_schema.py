import re
import os

log_path = r"C:\Users\spenc\.gemini\antigravity\brain\7fda1af2-8a69-42fe-a6fe-35a8bbd3803b\.system_generated\tasks\task-198.log"

if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    matches = [m.start() for m in re.finditer('"tools":', content)]
    print(f"Matches for '\"tools\":': {len(matches)}")
    
    for idx in matches[:5]:
        start = max(0, idx - 100)
        end = min(len(content), idx + 800)
        print(f"\n--- Match ---")
        print(content[start:end])
        print("-------------")
else:
    print("Log path not found.")
