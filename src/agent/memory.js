import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
class MemoryManager {
  constructor(databasePath = "./memory.db") {
    const dir = path.dirname(databasePath);
    if (dir !== "." && !fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    this.db = new Database(databasePath);
  }
  async initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        content TEXT,
        category TEXT DEFAULT 'fact',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        provider TEXT,
        model TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        task_request TEXT,
        tool_name TEXT,
        tool_args TEXT,
        tool_result TEXT,
        success_score INTEGER,
        error_message TEXT,
        active_skill TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_traces_tool ON traces(tool_name);
    `);
    try {
      this.db.prepare("ALTER TABLE traces ADD COLUMN active_skill TEXT").run();
    } catch (e) {}
  }
  async addMessage(session_id, role, content) { this.db.prepare("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)").run(session_id, role, content); }
  async addTokenUsage(session_id, provider, model, prompt_tokens, completion_tokens) { this.db.prepare("INSERT INTO token_usage (session_id, provider, model, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?, ?)").run(session_id, provider, model, prompt_tokens, completion_tokens); }
  async getStats() {
    const total = this.db.prepare("SELECT SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion FROM token_usage").get();
    const byModelRow = this.db.prepare("SELECT model, SUM(prompt_tokens) as prompt, SUM(completion_tokens) as completion FROM token_usage GROUP BY model ORDER BY SUM(prompt_tokens) + SUM(completion_tokens) DESC").all();
    return { total: { prompt: total.prompt || 0, completion: total.completion || 0 }, byModel: byModelRow };
  }
  async getRecentContext(session_id, limit = 10) { return this.db.prepare("SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?").all(session_id, limit).reverse(); }
  async getCoreMemories(user_id) {
    const rows = this.db.prepare("SELECT id, content, category FROM facts WHERE user_id = ? ORDER BY timestamp ASC").all(user_id);
    const cats = { fact: [], preference: [], rule: [], summary: [] };
    
    for (const r of rows) {
      const category = (r.category in cats) ? r.category : "fact";
      cats[category].push(`[ID: ${r.id}] ${r.content}`);
    }

    let out = "";
    if (cats.fact.length > 0) out += `### Facts\n${cats.fact.join("\n")}\n\n`;
    if (cats.preference.length > 0) out += `### Preferences\n${cats.preference.join("\n")}\n\n`;
    if (cats.rule.length > 0) out += `### Rules\n${cats.rule.join("\n")}\n\n`;
    if (cats.summary.length > 0) out += `### Summaries\n${cats.summary.join("\n")}\n\n`;
    
    return out.trim();
  }
  async addCoreMemory(user_id, content, category = "fact") {
    const finalCat = ["fact", "preference", "rule", "summary"].includes(category) ? category : "fact";
    this.db.prepare("INSERT INTO facts (user_id, content, category) VALUES (?, ?, ?)").run(user_id, content, finalCat);
    return `Memory added successfully to category: ${finalCat}.`;
  }
  async removeCoreMemory(user_id, id) {
    const res = this.db.prepare("DELETE FROM facts WHERE user_id = ? AND id = ?").run(user_id, id);
    if (res.changes > 0) { return "Memory removed successfully."; }
    return "Memory not found or already removed.";
  }
  async searchPastEvents(query) { const rows = this.db.prepare("SELECT role, content, timestamp FROM messages WHERE content LIKE ? ORDER BY timestamp DESC LIMIT 20").all(`%${query}%`); return rows.map(r => `[${r.timestamp}] ${r.role}: ${r.content}`).join("\\n"); }
  
  async addTrace(session_id, task_request, tool_name, tool_args, tool_result, success_score, error_message = null, active_skill = null) {
    let resultStr = typeof tool_result === "string" ? tool_result : JSON.stringify(tool_result);
    if (resultStr && resultStr.length > 2000) {
      resultStr = resultStr.substring(0, 2000) + "... [Truncated]";
    }
    const argsStr = typeof tool_args === "string" ? tool_args : JSON.stringify(tool_args);
    this.db.prepare("INSERT INTO traces (session_id, task_request, tool_name, tool_args, tool_result, success_score, error_message, active_skill) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(session_id, task_request, tool_name, argsStr, resultStr, success_score, error_message, active_skill);
  }
  async getRecentFailures(tool_name, limit = 2) {
    return this.db.prepare("SELECT error_message, timestamp FROM traces WHERE tool_name = ? AND success_score = 0 ORDER BY timestamp DESC LIMIT ?").all(tool_name, limit);
  }
  async getFullSessionMessages(session_id) {
    return this.db.prepare("SELECT id, role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC").all(session_id);
  }
  async truncateSessionMessages(session_id, idsToKeep) {
    if (idsToKeep.length === 0) {
      this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(session_id);
      return;
    }
    const placeholders = idsToKeep.map(() => "?").join(",");
    this.db.prepare(`DELETE FROM messages WHERE session_id = ? AND id NOT IN (${placeholders})`).run(session_id, ...idsToKeep);
  }
}
export default MemoryManager;
