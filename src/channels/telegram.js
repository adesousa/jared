import TelegramBot from "node-telegram-bot-api";
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

class TelegramChannel {
  constructor(config = {}) {
    this.enabled = config.enabled === true;
    this.token = config.token;
    this.bot = null;
  }

  start() {
    if (!this.enabled || !this.token) return;

    this.bot = new TelegramBot(this.token, { polling: true });

    this.bot.on("message", msg => {
      const chatId = msg.chat.id;
      const text = msg.text;
      // Skip non-text for simplicity in V1
      if (!text) return;

      const sessionId = sessionManager.getSessionId("telegram", msg.from.id);

      bus.emit("message:received", {
        channel: "telegram",
        userId: msg.from.id,
        sessionId: sessionId,
        content: text,
        meta: { chatId }
      });
    });

    bus.on("message:send", async payload => {
      if (payload.channel === "telegram" && payload.meta?.chatId) {
        try {
          await this.bot.sendMessage(payload.meta.chatId, payload.content);
        } catch (e) {
          logger.error("Telegram send error:", e);
        }
      }
    });

    logger.info("Telegram channel connected.");
  }
}

export default TelegramChannel;
