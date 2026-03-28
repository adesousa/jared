import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
// Note: Requires node modules like Puppeteer for WhatsApp web underlying engine
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

class WhatsAppChannel {
  constructor(config = {}) {
    this.enabled = config.enabled === true;
    this.client = null;
  }

  start() {
    if (!this.enabled) return;

    this.client = new Client({
      authStrategy: new LocalAuth()
    });

    this.client.on("qr", qr => {
      logger.info(
        "WhatsApp QR generated - please scan! (Use a QR terminal printer logic here)"
      );
    });

    this.client.on("ready", () => {
      logger.info("WhatsApp channel connected!");
    });

    this.client.on("message", async msg => {
      if (msg.from === "status@broadcast") return;

      const sessionId = sessionManager.getSessionId("whatsapp", msg.from);

      bus.emit("message:received", {
        channel: "whatsapp",
        userId: msg.from,
        sessionId: sessionId,
        content: msg.body,
        meta: { msgObject: msg }
      });
    });

    bus.on("message:send", async payload => {
      if (payload.channel === "whatsapp" && payload.meta?.msgObject) {
        try {
          await payload.meta.msgObject.reply(payload.content);
        } catch (e) {
          logger.error("WhatsApp send error:", e);
        }
      }
    });

    this.client.initialize();
  }
}

export default WhatsAppChannel;
