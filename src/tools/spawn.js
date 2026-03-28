export default {
  schema: {
    name: "spawn",
    description: "Spawn a background subagent to handle a task asynchronously. Use for complex or time-consuming tasks. The result will be sent back when complete.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task for the subagent to complete" },
        label: { type: "string", description: "Optional short label for display" }
      },
      required: ["task"]
    }
  },
  execute: async ({ task, label }, { agentManager, modelOverride, channel, userId, sessionId, bus }) => {
    const displayLabel = label || task.substring(0, 40);
    // Fire-and-forget: spawn a new subagent in the background
    // Pass isSubagent flag to the spinUp method
    agentManager.spinUp(task, { modelOverride, channel, userId, sessionId, isSubagent: true }).then(result => {
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
