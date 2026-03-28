import fs from "node:fs";
import bus from "../bus/index.js";

class HeartbeatManager {
  constructor(heartbeatPath, intervalMs = 30000) {
    this.heartbeatPath = heartbeatPath;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this._tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _tick() {
    const tasks = this._readTasks();
    if (tasks.length > 0) {
      bus.emit("heartbeat", { tasks, timestamp: Date.now() });
    }
  }

  _readTasks() {
    try {
      if (!fs.existsSync(this.heartbeatPath)) return [];
      const content = fs.readFileSync(this.heartbeatPath, "utf8");
      const activeMatch = content.match(/## Active Tasks\s*\n([\s\S]*?)(?=\n## |\n*$)/);
      if (!activeMatch) return [];
      return activeMatch[1]
        .split("\n")
        .filter(l => l.startsWith("- "))
        .map(l => l.slice(2).trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  beat() {
    bus.emit("heartbeat:manual", { timestamp: Date.now() });
  }
}

export default HeartbeatManager;
