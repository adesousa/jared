import fs from "node:fs/promises";
import path from "node:path";

class ContextManager {
  constructor(memoryManager, soulPath, isTeamRole = false) {
    this.memoryManager = memoryManager;
    this.soulPath = soulPath;
    this.isTeamRole = isTeamRole;
    this.soulCache = null;
  }

  async loadSoul() {
    if (!this.soulCache) {
      if (!this.isTeamRole) {
        // Prioritize user-level soul (.jared/SOUL.md) over default template
        const userSoulPath = path.join(process.cwd(), ".jared", "SOUL.md");
        try {
          await fs.access(userSoulPath);
          this.soulCache = await fs.readFile(userSoulPath, "utf8");
          return this.soulCache;
        } catch {
          // Fall through
        }
      }
      try {
        this.soulCache = await fs.readFile(this.soulPath, "utf8");
      } catch {
        this.soulCache = this.isTeamRole
          ? "You are a specialized agent."
          : "I am Jared, the AI COO.";
      }
    }
    return this.soulCache;
  }

  async buildPrompt(taskRequest, session_id, user_id, skillsContext = "") {
    const soulTemplate = await this.loadSoul();
    const coreMemories = await this.memoryManager.getCoreMemories(user_id);

    // Construct System Prompt
    const systemPrompt = `
${soulTemplate}
## Core Memory (Loaded from SQLite):
${coreMemories || "No core memory established yet."}
Proceed with your designated tasks efficiently.
You have native memory tools to optimize token consumption:
- use "search_memory" to quickly cherry-pick grep your past conversations (short & long term) when the user references something you don't instantly remember.
- use "add_memory" and "remove_memory" to curate the "Core Memory" section above. Update these dynamically whenever you learn something permanent about the user or project context. Ensure you select the appropriate \`category\`.
- use "exec" to execute shell commands when needed by your skills.
- use "web_search" and "web_fetch" to look up real-time information, news, or fetch content from links.
${skillsContext}
    `.trim();

    const history = await this.memoryManager.getRecentContext(session_id);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: taskRequest }
    ];

    return messages;
  }
}

export default ContextManager;
