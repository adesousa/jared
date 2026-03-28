import { Client, GatewayIntentBits } from "discord.js";
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

class DiscordChannel {
  constructor(config = {}) {
    this.enabled = config.enabled === true;
    this.token = config.token;
    this.client = null;
  }

  start() {
    if (!this.enabled || !this.token) return;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.client.once("ready", () => {
      logger.info(`Discord channel connected as ${this.client.user.tag}`);
    });

    this.client.on("messageCreate", async message => {
      if (message.author.bot) return;

      const sessionId = sessionManager.getSessionId(
        "discord",
        message.author.id
      );

      bus.emit("message:received", {
        channel: "discord",
        userId: message.author.id,
        sessionId: sessionId,
        content: message.content,
        meta: { channelId: message.channel.id }
      });
    });

    bus.on("message:send", async payload => {
      if (payload.channel === "discord" && payload.meta?.channelId) {
        try {
          const channel = await this.client.channels.fetch(
            payload.meta.channelId
          );
          if (channel) {
            await channel.send(payload.content);
          }
        } catch (e) {
          logger.error("Discord send error:", e);
        }
      }
    });

    this.client
      .login(this.token)
      .catch(e => logger.error("Discord login failed:", e));
  }
}

export default DiscordChannel;
