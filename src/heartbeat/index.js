import fs from "node:fs";
import bus from "../bus/index.js";

class HeartbeatManager {
  constructor(heartbeatPath, intervalMs = 30000) {
    this.heartbeatPath = heartbeatPath;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.lastFired = new Map();
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
    if (!fs.existsSync(this.heartbeatPath)) return;
    try {
      const content = fs.readFileSync(this.heartbeatPath, 'utf8');
      const lines = content.split('\n');
      
      let rewrittenLines = [];
      let jobsToRun = [];
      let currentCategory = null;
      let i = 0;
      
      while(i < lines.length) {
        let line = lines[i];
        
        if (line.startsWith('## ')) {
          currentCategory = line.substring(3).trim();
          rewrittenLines.push(line);
          i++;
          continue;
        }
        
        if (line.startsWith('### ')) {
          const header = line.substring(4).trim();
          const sepIndex = header.search(/\s+[-—]\s+/);
          let specStr = "9:00 AM";
          let title = header;
          if (sepIndex !== -1) {
              specStr = header.substring(0, sepIndex).trim();
              title = header.substring(sepIndex).replace(/^[-—\s]+/, '').trim();
          }
          
          let jobStartIndex = i;
          let tasksList = [];
          i++;
          
          while (i < lines.length && !lines[i].startsWith('##')) {
             if (lines[i].trim() !== '') {
                 if (lines[i].trim().startsWith('- ')) {
                     tasksList.push(lines[i].trim().substring(2));
                 } else {
                     tasksList.push(lines[i].trim());
                 }
             }
             i++;
          }
          
          const spec = this._extractTime(specStr, currentCategory);
          const now = new Date();
          const identifier = `${currentCategory}-${title}-${specStr}`;
          const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
          const firedKey = `${identifier}-${minuteKey}`;
          
          if (this._timeMatches(spec, now)) {
              if (!this.lastFired.has(firedKey)) {
                  this.lastFired.set(firedKey, true);
                  if (this.lastFired.size > 200) this.lastFired.clear();
                  
                  jobsToRun.push({ title, tasks: tasksList });
                  
                  const isOneShot = currentCategory && currentCategory.toLowerCase().includes('one shot');
                  if (isOneShot) {
                       // skip adding to rewrittenLines to delete the task
                       continue;
                  }
              }
          }
          for (let k = jobStartIndex; k < i; k++) {
             rewrittenLines.push(lines[k]);
          }
          continue;
        }
        
        rewrittenLines.push(line);
        i++;
      }
      
      if (jobsToRun.length > 0) {
         let aggregatedTasks = [];
         for (const job of jobsToRun) {
             aggregatedTasks.push(`[${job.title}]`);
             for (const t of job.tasks) aggregatedTasks.push(`- ${t}`);
         }
         bus.emit("heartbeat", { tasks: aggregatedTasks, timestamp: Date.now() });
         
         const newContent = rewrittenLines.join('\n');
         if (newContent !== content) {
             fs.writeFileSync(this.heartbeatPath, newContent, 'utf8');
         }
      }
    } catch (e) {
      console.error("[HeartbeatManager] Error tick:", e);
    }
  }

  _extractTime(str, currentCategory) {
      let spec = {};
      const timeMatch = str.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?/);
      if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3];
          if (ampm && ampm.toLowerCase() === "pm" && h < 12) h += 12;
          if (ampm && ampm.toLowerCase() === "am" && h === 12) h = 0;
          spec.hour = [h];
          spec.minute = [m];
      }
      const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const upperStr = str.toUpperCase();
      for (let i = 0; i < days.length; i++) {
          if (upperStr.includes(days[i])) {
              spec.dow = [i];
              break;
          }
      }
      const domMatch = str.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
      if (domMatch) {
          spec.dom = [parseInt(domMatch[1], 10)];
      }
      if (!spec.hour) {
          spec.hour = [9];
          spec.minute = [0];
      }
      if (currentCategory) {
          const lowerCat = currentCategory.toLowerCase();
          if (lowerCat.includes('weekly') && !spec.dow) spec.dow = [1];
          if (lowerCat.includes('monthly') && !spec.dom) spec.dom = [1];
      }
      return spec;
  }

  _timeMatches(spec, date) {
      if (spec.minute && !spec.minute.includes(date.getMinutes())) return false;
      if (spec.hour && !spec.hour.includes(date.getHours())) return false;
      if (spec.dom && !spec.dom.includes(date.getDate())) return false;
      if (spec.dow && !spec.dow.includes(date.getDay())) return false;
      return true;
  }

  beat() {
    bus.emit("heartbeat:manual", { timestamp: Date.now() });
  }
}

export default HeartbeatManager;
