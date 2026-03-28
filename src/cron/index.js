import bus from "../bus/index.js";
import { logger } from "../utils/index.js";

class CronScheduler {
  constructor() {
    this.jobs = new Map();
    this.timer = null;
    this._idCounter = 1;
  }

  addJob({ message, everyMs, cronExpr, tz, atMs, channel, userId, sessionId, deleteAfter = false }) {
    const id = `job_${this._idCounter++}`;
    const job = { id, message, channel, userId, sessionId, deleteAfter, lastRun: Date.now() };
    if (everyMs) {
      job.kind = "every";
      job.intervalMs = everyMs;
    } else if (cronExpr) {
      job.kind = "cron";
      job.cronExpr = cronExpr;
      job.tz = tz || null;
    } else if (atMs) {
      job.kind = "at";
      job.atMs = atMs;
      job.deleteAfter = true;
    }
    this.jobs.set(id, job);
    return job;
  }

  removeJob(jobId) {
    return this.jobs.delete(jobId);
  }

  listJobs() {
    return [...this.jobs.values()].map(j => ({
      id: j.id, kind: j.kind, message: j.message,
      ...(j.intervalMs ? { everySeconds: j.intervalMs / 1000 } : {}),
      ...(j.cronExpr ? { cronExpr: j.cronExpr, tz: j.tz } : {}),
      ...(j.atMs ? { at: new Date(j.atMs).toISOString() } : {})
    }));
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60000);
    logger.info("Cron scheduler started.");
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  tick() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      let shouldFire = false;
      if (job.kind === "every" && (now - job.lastRun >= job.intervalMs)) {
        shouldFire = true;
      } else if (job.kind === "at" && now >= job.atMs) {
        shouldFire = true;
      } else if (job.kind === "cron") {
        shouldFire = this._matchCron(job.cronExpr, job.tz);
      }
      if (shouldFire) {
        job.lastRun = now;
        logger.info(`Cron firing: ${job.message}`);
        bus.emit("message:send", {
          channel: job.channel, userId: job.userId, sessionId: job.sessionId,
          content: `⏰ ${job.message}`
        });
        if (job.deleteAfter) this.jobs.delete(id);
      }
    }
  }

  _matchCron(expr, tz) {
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) return false;
    const now = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
    const fields = [now.getMinutes(), now.getHours(), now.getDate(), now.getMonth() + 1, now.getDay()];
    return parts.every((p, i) => {
      if (p === "*") return true;
      if (p.includes("/")) { const step = parseInt(p.split("/")[1]); return fields[i] % step === 0; }
      if (p.includes(",")) return p.split(",").map(Number).includes(fields[i]);
      if (p.includes("-")) { const [a, b] = p.split("-").map(Number); return fields[i] >= a && fields[i] <= b; }
      return parseInt(p) === fields[i];
    });
  }
}

export default new CronScheduler();
