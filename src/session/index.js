import crypto from "node:crypto";
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.config = null;
    this.unifiedSessionId = null;
  }

  configure(config) {
    this.config = config;
    this.unifiedSessionId = crypto.randomUUID();
  }

  getSessionId(channel, userId) {
    const isConsole = channel === "console";
    const isCron = channel === "cron";
    const isWhatsappSelf = channel === "whatsapp" && this.config?.channels?.whatsapp?.selfChatOnly === true;

    if (this.unifiedSessionId && (isConsole || isCron || isWhatsappSelf)) {
      return this.unifiedSessionId;
    }

    const key = `${channel}:${userId}`;
    if (!this.sessions.has(key)) { const newSessionId = crypto.randomUUID(); this.sessions.set(key, newSessionId); }
    return this.sessions.get(key);
  }

  clearSession(channel, userId) {
    const isConsole = channel === "console";
    const isCron = channel === "cron";
    const isWhatsappSelf = channel === "whatsapp" && this.config?.channels?.whatsapp?.selfChatOnly === true;

    if (this.unifiedSessionId && (isConsole || isCron || isWhatsappSelf)) {
      return;
    }

    const key = `${channel}:${userId}`;
    this.sessions.delete(key);
  }
}
export default new SessionManager();
