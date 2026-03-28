export default {
  schema: {
    name: "cron",
    description: "Schedule reminders and recurring tasks. Actions: add, list, remove.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "list", "remove"], description: "Action to perform" },
        message: { type: "string", description: "Reminder message (for add)" },
        every_seconds: { type: "integer", description: "Interval in seconds (for recurring tasks)" },
        cron_expr: { type: "string", description: "Cron expression like '0 9 * * *' (for scheduled tasks)" },
        tz: { type: "string", description: "IANA timezone for cron expressions (e.g. 'Europe/Paris')" },
        at: { type: "string", description: "ISO datetime for one-time execution (e.g. '2026-03-21T10:30:00')" },
        job_id: { type: "string", description: "Job ID (for remove)" }
      },
      required: ["action"]
    }
  },
  execute: async ({ action, message, every_seconds, cron_expr, tz, at, job_id }, { cronScheduler, channel, userId, sessionId }) => {
    if (action === "list") {
      const jobs = cronScheduler.listJobs();
      if (jobs.length === 0) return "No scheduled jobs.";
      return "Scheduled jobs:\n" + jobs.map(j => `- ${j.id} [${j.kind}] ${j.message}`).join("\n");
    }
    if (action === "remove") {
      if (!job_id) return "Error: job_id is required for remove";
      return cronScheduler.removeJob(job_id) ? `Removed job ${job_id}` : `Job ${job_id} not found`;
    }
    if (action === "add") {
      if (!message) return "Error: message is required for add";
      const opts = { message, channel, userId, sessionId };
      if (every_seconds) {
        opts.everyMs = every_seconds * 1000;
      } else if (cron_expr) {
        opts.cronExpr = cron_expr;
        opts.tz = tz || null;
      } else if (at) {
        opts.atMs = new Date(at).getTime();
      } else {
        return "Error: provide every_seconds, cron_expr, or at";
      }
      const job = cronScheduler.addJob(opts);
      return `Created job '${job.id}' [${job.kind}]: ${message}`;
    }
    return `Unknown action: ${action}`;
  }
};
