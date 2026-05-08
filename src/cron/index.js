import fs from "node:fs";
import path from "node:path";
import bus from "../bus/index.js";
import { logger } from "../utils/index.js";

class CronScheduler {
  constructor() {
    this.jobs = new Map();
    this.timer = null;
    this.projectName = null;
    this.backlogPath = null;
    this.lastMtime = 0;
    this.fileState = {
      "One Shot Tasks": [],
      "Daily Tasks": [],
      "Weekly Tasks": [],
      "Monthly Tasks": [],
      "Product Backlog": []
    };
    this._idCounter = 1;
  }

  async start(projectName) {
    this.projectName = projectName;
    this.backlogPath = path.join(process.cwd(), ".jared", projectName, "BACKLOG.md");
    if (this.timer) return;
    await this.loadFromFile();
    this.timer = setInterval(() => this.tick(), 60000);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async loadFromFile() {
    if (!this.backlogPath) return;
    try {
      const stats = await fs.promises.stat(this.backlogPath);
      this.lastMtime = stats.mtimeMs;
      
      const content = await fs.promises.readFile(this.backlogPath, "utf8");
      const lines = content.split('\n');
      
      const newState = {
        "One Shot Tasks": [],
        "Daily Tasks": [],
        "Weekly Tasks": [],
        "Monthly Tasks": [],
        "Product Backlog": []
      };
      
      let currentCategory = null;
      let currentTask = null;
      
      for (const line of lines) {
        if (line.startsWith("## ")) {
          currentCategory = line.substring(3).trim();
          currentTask = null;
          if (!newState[currentCategory]) {
             newState[currentCategory] = [];
          }
          continue;
        }
        
        if (currentCategory === "Product Backlog" && line.trim().startsWith("-")) {
           newState[currentCategory].push(line);
           continue;
        }
        
        if (line.startsWith("### ")) {
          const header = line.substring(4).trim();
          const tagMatch = header.match(/^(?:⏰|📅)\s*(.*?)\s*[—\-]\s*(.*)$/);
          if (tagMatch) {
            const timeStr = tagMatch[1].trim();
            const title = tagMatch[2].trim();
            currentTask = { timeStr, title, description: [] };
            newState[currentCategory].push(currentTask);
          } else {
             const oldMatch = header.match(/^(.*?)\s*[—\-]\s*(.*)$/);
             if (oldMatch) {
                 currentTask = { timeStr: oldMatch[1].trim(), title: oldMatch[2].trim(), description: [] };
                 newState[currentCategory].push(currentTask);
             } else {
                 currentTask = { timeStr: "09:00", title: header, description: [] };
                 newState[currentCategory].push(currentTask);
             }
          }
          continue;
        }
        
        if (currentTask && line.trim() !== "" && !line.startsWith("#")) {
           currentTask.description.push(line);
        } else if (currentCategory && !currentTask && line.trim() !== "" && !line.startsWith("#") && currentCategory !== "Product Backlog") {
           newState[currentCategory].push({ timeStr: "09:00", title: "Task", description: [line] });
        }
      }
      
      this.fileState = newState;
      this._syncJobsFromState();
    } catch (e) {
      if (e.code !== 'ENOENT') {
          logger.error("Error loading BACKLOG.md:", e);
      }
    }
  }

  async saveToFile() {
    if (!this.backlogPath) return;
    try {
      const lines = ["# Project Backlog", ""];
      
      const writeCategory = (catName, tasks, isBacklog = false) => {
          lines.push(`## ${catName}`);
          if (isBacklog) {
              for (const line of tasks) {
                  lines.push(line);
              }
          } else {
              const tag = catName === "One Shot Tasks" ? "📅" : "⏰";
              for (const task of tasks) {
                  lines.push(`### ${tag} ${task.timeStr} — ${task.title}`);
                  for (const desc of task.description) {
                      lines.push(desc);
                  }
                  lines.push("");
              }
          }
          if (!isBacklog && tasks.length === 0) lines.push("");
          else if (isBacklog) lines.push("");
      };
      
      writeCategory("One Shot Tasks", this.fileState["One Shot Tasks"] || []);
      writeCategory("Daily Tasks", this.fileState["Daily Tasks"] || []);
      writeCategory("Weekly Tasks", this.fileState["Weekly Tasks"] || []);
      writeCategory("Monthly Tasks", this.fileState["Monthly Tasks"] || []);
      writeCategory("Product Backlog", this.fileState["Product Backlog"] || [], true);
      
      await fs.promises.writeFile(this.backlogPath, lines.join("\n").replace(/\n{3,}/g, '\n\n'), "utf8");
      const stats = await fs.promises.stat(this.backlogPath);
      this.lastMtime = stats.mtimeMs;
    } catch (e) {
       logger.error("Error saving BACKLOG.md:", e);
    }
  }

  _parseTimeStr(category, timeStr) {
      const t = timeStr.toLowerCase();
      
      if (category === "One Shot Tasks") {
          const d = new Date(timeStr);
          if (!isNaN(d.getTime())) return { kind: "at", atMs: d.getTime() };
      }
      
      const timeMatch = t.match(/(\d{1,2}):(\d{2})/);
      const hour = timeMatch ? parseInt(timeMatch[1], 10) : 9;
      const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;
      
      if (category === "Daily Tasks") {
          return { kind: "cron", cronExpr: `${minute} ${hour} * * *` };
      }
      
      if (category === "Weekly Tasks") {
          const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const frenchDays = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
          let dayIndex = 1;
          for (let i = 0; i < days.length; i++) {
              if (t.includes(days[i]) || t.includes(frenchDays[i])) {
                  dayIndex = i;
                  break;
              }
          }
          return { kind: "cron", cronExpr: `${minute} ${hour} * * ${dayIndex}` };
      }
      
      if (category === "Monthly Tasks") {
          const dayMatch = t.match(/(\d{1,2})(?:st|nd|rd|th|er|ème)/i) || t.match(/(?:le\s)?(\d{1,2})\b/i);
          const dom = dayMatch ? parseInt(dayMatch[1], 10) : 1;
          return { kind: "cron", cronExpr: `${minute} ${hour} ${dom} * *` };
      }
      
      return { kind: "cron", cronExpr: `0 9 * * *` };
  }

  _syncJobsFromState() {
     const oldJobs = Array.from(this.jobs.values());
     this.jobs.clear();
     
     const processCategory = (catName) => {
        const tasks = this.fileState[catName] || [];
        for (const task of tasks) {
            const parsed = this._parseTimeStr(catName, task.timeStr);
            const prevJob = oldJobs.find(j => j.category === catName && j.title === task.title && j.timeStr === task.timeStr);
            const id = `job_${this._idCounter++}`;
            const job = {
                id,
                category: catName,
                title: task.title,
                message: task.title + "\n" + task.description.join("\n"),
                lastRun: prevJob ? prevJob.lastRun : 0,
                timeStr: task.timeStr,
                ...parsed
            };
            this.jobs.set(id, job);
        }
     };
     
     processCategory("One Shot Tasks");
     processCategory("Daily Tasks");
     processCategory("Weekly Tasks");
     processCategory("Monthly Tasks");
  }

  async addJob(category, timeStr, title, description) {
     if (!this.fileState[category]) this.fileState[category] = [];
     this.fileState[category].push({ timeStr, title, description });
     await this.saveToFile();
     await this.loadFromFile();
     return true;
  }

  async removeJob(title) {
     let removed = false;
     for (const cat of ["One Shot Tasks", "Daily Tasks", "Weekly Tasks", "Monthly Tasks"]) {
         const tasks = this.fileState[cat];
         if (tasks) {
             const len = tasks.length;
             this.fileState[cat] = tasks.filter(t => t.title !== title);
             if (this.fileState[cat].length < len) removed = true;
         }
     }
     if (removed) {
         await this.saveToFile();
         await this.loadFromFile();
     }
     return removed;
  }

  listJobs() {
      return [...this.jobs.values()];
  }

  async tick() {
    if (this.backlogPath) {
        try {
            const stats = await fs.promises.stat(this.backlogPath);
            const currentMtime = stats.mtimeMs;
            if (currentMtime > this.lastMtime) {
                logger.debug("BACKLOG.md changed manually, reloading...");
                await this.loadFromFile();
            }
        } catch (e) {
            if (e.code !== 'ENOENT') {
                logger.error("Error stat-ing BACKLOG.md in tick:", e);
            }
        }
    }
  
    const now = Date.now();
    const oneShotsToRemove = [];
    const currentJobs = Array.from(this.jobs.values());
    
    for (const job of currentJobs) {
      let shouldFire = false;
      if (job.kind === "at" && now >= job.atMs) {
        shouldFire = true;
      } else if (job.kind === "cron") {
        shouldFire = this._matchCron(job.cronExpr);
      }
      
      if (shouldFire && now - job.lastRun > 60000) {
        job.lastRun = now;
        
        const realJob = this.jobs.get(job.id);
        if (realJob) realJob.lastRun = now;
        
        logger.debug(`Cron firing: [${job.category}] ${job.title}`);
        bus.emit("cron:trigger", { tasks: [job.message], timestamp: now });
        
        if (job.category === "One Shot Tasks") {
            oneShotsToRemove.push(job.title);
        }
      }
    }
    
    if (oneShotsToRemove.length > 0) {
        let changed = false;
        const tasks = this.fileState["One Shot Tasks"];
        if (tasks) {
            const initialLength = tasks.length;
            this.fileState["One Shot Tasks"] = tasks.filter(t => !oneShotsToRemove.includes(t.title));
            if (this.fileState["One Shot Tasks"].length < initialLength) changed = true;
        }
        if (changed) {
            await this.saveToFile();
            await this.loadFromFile();
        }
    }
  }

  _matchCron(expr) {
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) return false;
    const now = new Date();
    const fields = [now.getMinutes(), now.getHours(), now.getDate(), now.getMonth() + 1, now.getDay()];
    return parts.every((p, i) => {
      if (p === "*") return true;
      if (p.includes("/")) { const step = parseInt(p.split("/")[1], 10); return fields[i] % step === 0; }
      if (p.includes(",")) return p.split(",").map(Number).includes(fields[i]);
      if (p.includes("-")) { const [a, b] = p.split("-").map(Number); return fields[i] >= a && fields[i] <= b; }
      return parseInt(p, 10) === fields[i];
    });
  }
}

export default new CronScheduler();
