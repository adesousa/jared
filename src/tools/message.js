export default {
  schema: {
    name: "message",
    description: "Send a proactive message to the user. Use to communicate progress, notifications, or deliver results on a specific channel.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The message content to send" },
        target_channel: { type: "string", description: "Optional: target channel (telegram, discord, slack, console). Defaults to current channel." },
        target_user: { type: "string", description: "Optional: target user ID. Defaults to current user." }
      },
      required: ["content"]
    }
  },
  execute: async ({ content, target_channel, target_user }, { bus, channel, userId, sessionId }) => {
    let destChannel = target_channel || channel;
    if (destChannel === "cron" || destChannel === "system") {
      destChannel = "console";
    }
    const destUser = target_user || userId;
    bus.emit("message:send", { channel: destChannel, userId: destUser, sessionId, content });
    return `Message sent to ${destChannel}:${destUser}`;
  }
};
