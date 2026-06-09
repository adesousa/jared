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
  execute: async ({ task, label, role }, { agentManager, modelOverride, channel, userId, sessionId, bus, isSubagent, memory }) => {
    if (isSubagent) {
      throw new Error("Subagents cannot spawn other subagents. You must perform the task yourself.");
    }
    const displayLabel = label || task.substring(0, 40);
    bus.emit("subagent:start", { channel, sessionId });
    const formatRole = (r) => { if (!r) return "Subagent"; return r.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); };
    const roleStr = formatRole(role);
    agentManager.spinUp(task, { modelOverride, channel, userId, sessionId, isSubagent: true, role }).then(async result => {
      bus.emit("subagent:end", { channel, sessionId });
      const content = `🔄 Background task "${displayLabel}" completed by \`${roleStr}\`:\n${result.content}`;
      if (memory) {
        try {
          await memory.addMessage(sessionId, "assistant", content);
        } catch (e) {}
      }
      bus.emit("message:send", {
        channel,
        userId,
        sessionId,
        content,
        usage: result.usage,
        attempt: result.attempt
      });
    }).catch(async err => {
      bus.emit("subagent:end", { channel, sessionId });
      const content = `❌ Background task "${displayLabel}" by \`${roleStr}\` failed: ${err.message}`;
      if (memory) {
        try {
          await memory.addMessage(sessionId, "assistant", content);
        } catch (e) {}
      }
      bus.emit("message:send", { channel, userId, sessionId, content });
    });
    return `Spawned background task: "${displayLabel}" for \`${roleStr}\`. Results will be delivered when complete.`;
  }
};
