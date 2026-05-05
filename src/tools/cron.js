export default {
  schema: {
    name: "cron",
    description: "Schedule reminders and recurring tasks. Persists automatically to BACKLOG.md. Categories: 'One Shot Tasks', 'Daily Tasks', 'Weekly Tasks', 'Monthly Tasks'. Actions: add, list, remove.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "list", "remove"], description: "Action to perform" },
        category: { type: "string", enum: ["One Shot Tasks", "Daily Tasks", "Weekly Tasks", "Monthly Tasks"], description: "Required for 'add'" },
        time_spec: { type: "string", description: "Time string. Daily: '09:00', Weekly: 'Wednesday 09:00', Monthly: '25th 10:00', One Shot: '2026-05-04 10:00'" },
        title: { type: "string", description: "Title of the task (for add/remove)" },
        description: { type: "string", description: "Actionable description with bullet points (for add)" }
      },
      required: ["action"]
    }
  },
  execute: async ({ action, category, time_spec, title, description }, { cronScheduler }) => {
    if (action === "list") {
      const jobs = cronScheduler.listJobs();
      if (jobs.length === 0) return "No scheduled jobs in BACKLOG.md.";
      return "Scheduled jobs:\n" + jobs.map(j => `- [${j.category}] ${j.title} (Time: ${j.timeStr || j.cronExpr || new Date(j.atMs).toLocaleString()})`).join("\n");
    }
    
    if (action === "remove") {
      if (!title) return "Error: title is required for remove";
      return cronScheduler.removeJob(title) ? `Removed task '${title}' from BACKLOG.md` : `Task '${title}' not found`;
    }
    
    if (action === "add") {
      if (!category || !time_spec || !title) {
         return "Error: category, time_spec, and title are required for add";
      }
      
      let descLines = [];
      if (description) {
         descLines = description.split('\n').map(l => l.trim().startsWith('-') ? l.trim() : `- ${l.trim()}`);
      }
      cronScheduler.addJob(category, time_spec, title, descLines);
      
      return `Added task '${title}' to '${category}' in BACKLOG.md`;
    }
    
    return `Unknown action: ${action}`;
  }
};
