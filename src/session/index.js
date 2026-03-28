class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSessionId(channel, userId) {
    const key = `${channel}:${userId}`;
    if (!this.sessions.has(key)) {
      const newSessionId = `session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      this.sessions.set(key, newSessionId);
    }
    return this.sessions.get(key);
  }

  clearSession(channel, userId) {
    const key = `${channel}:${userId}`;
    this.sessions.delete(key);
  }
}

export default new SessionManager();
