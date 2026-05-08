import fs from "node:fs/promises";
import path from "node:path";

class ContextManager {
  constructor(
    memoryManager,
    soulPath,
    isTeamRole = false,
    securityConfig = {}
  ) {
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

    const workspaceContext =
      this.securityConfig?.restrictToWorkspace &&
      this.securityConfig?.workspaceDir
        ? `\n## Workspace Info:\nYou are restricted to the following workspace directory: ${this.securityConfig.workspaceDir}\nYou cannot access files outside of this directory.\n`
        : "";

    // Construct System Prompt
    const systemPrompt = `
${soulTemplate}

## Current System Time
The current local date and time is: ${new Date().toLocaleString()}
${workspaceContext}

## Core Memory (Persistence)
${coreMemories || "No core memory established yet. Use 'add_memory' to record facts about the user or project."}

## Operational Tools
You have native tools to optimize your performance and persist knowledge:
- **Memory**: use "search_memory" to retrieve context from past conversations.
- **IMPORTANT**: You MUST use "add_memory" immediately when the user provides facts, preferences, or rules. Do not just acknowledge them in chat; you MUST persist them to your Core Memory database to remember them in future sessions.
- **Execution**: use "exec" to execute shell commands. This is your primary way to interact with the system. Follow any user-provided rules about command syntax (e.g., DOS vs. Shell).
- **Web**: use "web_search" and "web_fetch" to look up real-time information, news, or fetch content from links.

${teamContext}${skillsContext}${mcpContext}

Proceed with your designated tasks efficiently.
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
