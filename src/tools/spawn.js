export default {
  schema: {
    name: "spawn",
    description: "Spawn a background subagent to handle a task asynchronously. Use for complex or time-consuming tasks. The result will be sent back when complete.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task for the subagent to complete" },
        label: { type: "string", description: "Optional short label for display" },
        role: { type: "string", description: "Optional role for the subagent, mapping to a file in src/team (e.g. 'web_developer'). If omitted, defaults to general subagent." }
      },
      required: ["task"]
    }
  },
  execute: async ({ task, label, role }, { agentManager, modelOverride, channel, userId, sessionId, bus }) => {
    const displayLabel = label || task.substring(0, 40);
    // Fire-and-forget: spawn a new subagent in the background
    // Pass isSubagent flag and role to the spinUp method
    agentManager.spinUp(task, { modelOverride, channel, userId, sessionId, isSubagent: true, role }).then(result => {
      bus.emit("message:send", {
        channel, userId, sessionId,
        content: `🔄 Background task "${displayLabel}" completed:\n${result.content}`
      });
    }).catch(err => {
      bus.emit("message:send", {
        channel, userId, sessionId,
        content: `❌ Background task "${displayLabel}" failed: ${err.message}`
      });
    });
    return `Spawned background task: "${displayLabel}". Results will be delivered when complete.`;
  }
};
