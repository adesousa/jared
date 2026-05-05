import fs from "node:fs/promises";
import path from "node:path";

class ContextManager {
  constructor(memoryManager, soulPath, isTeamRole = false, securityConfig = {}) {
    this.memoryManager = memoryManager;
    this.soulPath = soulPath;
    this.isTeamRole = isTeamRole;
    this.securityConfig = securityConfig;
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

  async getTeamContext() {
    try {
      const teamDir = path.join(process.cwd(), "src", "team");
      const files = await fs.readdir(teamDir);
      const roles = files
        .filter(f => f.endsWith(".md"))
        .map(f => f.replace(".md", ""));
      if (roles.length > 0) {
        return `\n## Available Team Members (Subagents)\nYou can use the "spawn" tool to delegate tasks to subagents. Available roles: ${roles.join(", ")}\n`;
      }
    } catch {
      // Ignore if directory doesn't exist
    }
    return "";
  }

  async buildPrompt(
    taskRequest,
    session_id,
    user_id,
    skillsContext = "",
    mcpContext = ""
  ) {
    const soulTemplate = await this.loadSoul();
    const coreMemories = await this.memoryManager.getCoreMemories(user_id);
    const teamContext = await this.getTeamContext();

    const workspaceContext = this.securityConfig?.restrictToWorkspace && this.securityConfig?.workspaceDir 
      ? `\n## Workspace Info:\nYou are restricted to the following workspace directory: ${this.securityConfig.workspaceDir}\nYou cannot access files outside of this directory.\n` 
      : "";

    // Construct System Prompt
    const systemPrompt = `
${soulTemplate}
## Current System Time:
The current local date and time is: ${new Date().toLocaleString()}
${workspaceContext}
## Core Memory (Loaded from SQLite):
${coreMemories || "No core memory established yet."}
Proceed with your designated tasks efficiently.
You have native memory tools to optimize token consumption:
- use "search_memory" to quickly cherry-pick grep your past conversations (short & long term) when the user references something you don't instantly remember.
- use "add_memory" and "remove_memory" to curate the "Core Memory" section above. Update these dynamically whenever you learn something permanent about the user or project context. Ensure you select the appropriate \`category\`.
- use "exec" to execute shell commands when needed by your skills. If restricted to a workspace, your current working directory is the root of your workspace and you cannot traverse above it.
- use "web_search" and "web_fetch" to look up real-time information, news, or fetch content from links.
${teamContext}${skillsContext}${mcpContext}
    `.trim();
    // console.log(systemPrompt);
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
