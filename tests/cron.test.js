import test from "node:test";
import assert from "node:assert";
import cronScheduler from "../src/cron/index.js";

// Reset cron state before each test
function resetCron() {
  cronScheduler.jobs.clear();
  cronScheduler._idCounter = 1;
  cronScheduler.stop();
}

test("CronScheduler addJob creates interval job", () => {
  resetCron();
  const job = cronScheduler.addJob({ message: "test every 5s", everyMs: 5000, channel: "console", userId: "u1", sessionId: "s1" });
  assert.strictEqual(job.kind, "every");
  assert.strictEqual(job.intervalMs, 5000);
  assert.strictEqual(job.message, "test every 5s");
  assert.ok(job.id.startsWith("job_"));
});

test("CronScheduler addJob creates cron expression job", () => {
  resetCron();
  const job = cronScheduler.addJob({ message: "daily 9am", cronExpr: "0 9 * * *", tz: "Europe/Paris", channel: "telegram", userId: "u1", sessionId: "s1" });
  assert.strictEqual(job.kind, "cron");
  assert.strictEqual(job.cronExpr, "0 9 * * *");
  assert.strictEqual(job.tz, "Europe/Paris");
});

test("CronScheduler addJob creates one-time at job with auto-delete", () => {
  resetCron();
  const futureMs = Date.now() + 60000;
  const job = cronScheduler.addJob({ message: "reminder", atMs: futureMs, channel: "console", userId: "u1", sessionId: "s1" });
  assert.strictEqual(job.kind, "at");
  assert.strictEqual(job.deleteAfter, true);
  assert.strictEqual(job.atMs, futureMs);
});

test("CronScheduler listJobs returns all jobs", () => {
  resetCron();
  cronScheduler.addJob({ message: "job1", everyMs: 1000, channel: "c", userId: "u", sessionId: "s" });
  cronScheduler.addJob({ message: "job2", cronExpr: "0 * * * *", channel: "c", userId: "u", sessionId: "s" });
  const jobs = cronScheduler.listJobs();
  assert.strictEqual(jobs.length, 2);
  assert.strictEqual(jobs[0].message, "job1");
  assert.strictEqual(jobs[1].message, "job2");
});

test("CronScheduler removeJob deletes by id", () => {
  resetCron();
  const job = cronScheduler.addJob({ message: "to remove", everyMs: 1000, channel: "c", userId: "u", sessionId: "s" });
  assert.strictEqual(cronScheduler.listJobs().length, 1);
  const removed = cronScheduler.removeJob(job.id);
  assert.strictEqual(removed, true);
  assert.strictEqual(cronScheduler.listJobs().length, 0);
});

test("CronScheduler removeJob returns false for unknown id", () => {
  resetCron();
  assert.strictEqual(cronScheduler.removeJob("nonexistent"), false);
});

test("CronScheduler tick fires interval job when time has elapsed", async () => {
  resetCron();
  const job = cronScheduler.addJob({ message: "tick test", everyMs: 1, channel: "c", userId: "u", sessionId: "s" });
  // Force lastRun to the past so the interval is exceeded
  job.lastRun = Date.now() - 1000;

  const events = [];
  const { default: bus } = await import("../src/bus/index.js");
  const handler = (payload) => events.push(payload);
  bus.on("message:send", handler);

  cronScheduler.tick();

  bus.off("message:send", handler);
  assert.strictEqual(events.length, 1);
  assert.ok(events[0].content.includes("tick test"));
});

test("CronScheduler tick auto-deletes one-shot at job after firing", async () => {
  resetCron();
  const pastMs = Date.now() - 1000;
  cronScheduler.addJob({ message: "one-shot", atMs: pastMs, channel: "c", userId: "u", sessionId: "s" });
  assert.strictEqual(cronScheduler.jobs.size, 1);

  const { default: bus } = await import("../src/bus/index.js");
  const handler = () => {};
  bus.on("message:send", handler);
  cronScheduler.tick();
  bus.off("message:send", handler);

  assert.strictEqual(cronScheduler.jobs.size, 0);
});

test("CronScheduler start is idempotent", () => {
  resetCron();
  cronScheduler.start();
  const firstTimer = cronScheduler.timer;
  cronScheduler.start();
  assert.strictEqual(cronScheduler.timer, firstTimer);
  cronScheduler.stop();
});

test("CronScheduler _matchCron matches wildcard pattern", () => {
  resetCron();
  assert.strictEqual(cronScheduler._matchCron("* * * * *"), true);
});
