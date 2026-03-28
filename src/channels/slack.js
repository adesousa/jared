import { SocketModeClient } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

class SlackChannel {
  constructor(config = {}) {
    this.enabled = config.enabled === true;
    this.botToken = config.botToken;
    this.appToken = config.appToken;
    this.socket = null;
    this.web = null;
  }

  async start() {
    if (!this.enabled || !this.botToken || !this.appToken) return;

    this.web = new WebClient(this.botToken);
    this.socket = new SocketModeClient({ appToken: this.appToken });

    this.socket.on("message", async ({ event, body, ack }) => {
      if (ack) await ack();
      if (!event || event.bot_id || !event.text) return;

      const sessionId = sessionManager.getSessionId("slack", event.user);

      bus.emit("message:received", {
        channel: "slack",
        userId: event.user,
        sessionId,
        content: event.text,
        meta: { slackChannel: event.channel }
      });
    });

    bus.on("message:send", async payload => {
      if (payload.channel === "slack" && payload.meta?.slackChannel) {
        try {
          await this.web.chat.postMessage({ channel: payload.meta.slackChannel, text: payload.content });
        } catch (e) {
          logger.error("Slack send error:", e);
        }
      }
    });

    await this.socket.start();
    logger.info("Slack channel connected (Socket Mode).");
  }
}

export default SlackChannel;
