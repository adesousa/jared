import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../utils/index.js";

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
    this.templateCache = new Map();
  }
  async _loadTemplate(name, placeholders = {}) {
    if (this.templateCache.has(name)) {
      let content = this.templateCache.get(name);
      for (const [key, value] of Object.entries(placeholders)) {
        content = content.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
      return content;
    }
    const templatePath = path.join(
      process.cwd(),
      "src",
      "identity",
      `${name}.md`
    );
    try {
      const content = await fs.readFile(templatePath, "utf8");
      this.templateCache.set(name, content);
      let replaced = content;
      for (const [key, value] of Object.entries(placeholders)) {
        replaced = replaced.replace(new RegExp(`{{${key}}}`, "g"), value);
      }
      return replaced;
    } catch (err) {
      logger.warn(
        `[Context] Template ${name} not found or unreadable at ${templatePath}`
      );
      return "";
    }
  }
  async loadSoul() {
    if (!this.soulCache) {
      if (!this.isTeamRole) {
        const userSoulPath = path.join(process.cwd(), ".jared", "SOUL.md");
        try {
          await fs.access(userSoulPath);
          this.soulCache = await fs.readFile(userSoulPath, "utf8");
          return this.soulCache;
        } catch {}
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
        return await this._loadTemplate("TEAM", { roles: roles.join(", ") });
      }
    } catch {}
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
        ? await this._loadTemplate("WORKSPACE", {
            workspaceDir: this.securityConfig.workspaceDir
          })
        : "";

    const memoryContext = await this._loadTemplate("MEMORY", {
      coreMemories:
        coreMemories ||
        "No core memory established yet. Use 'add_memory' to record facts about the user or project."
    });

    const toolsContext = await this._loadTemplate("TOOLS");

    const systemPrompt = `
${soulTemplate}
## Current System Time
The current local date and time is: ${new Date().toLocaleString()}

${workspaceContext}
${memoryContext}
${toolsContext}

${teamContext}
${skillsContext}
${mcpContext}

Proceed with the tasks efficiently.
    `.trim();
    logger.debug(`System Prompt:\n${systemPrompt}`);
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
