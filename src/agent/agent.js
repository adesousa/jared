import AgentLoop from "./loop.js";
import MemoryManager from "./memory.js";
import SkillsManager from "./skills.js";
import ContextManager from "./context.js";
import ExecGuard from "./exec-guard.js";
import ProviderRouter from "../providers/router.js";
import MCPManager from "../mcp/index.js";
import cronScheduler from "../cron/index.js";
import bus from "../bus/index.js";

import fs from "node:fs";
import path from "node:path";

class AgentManager {
  constructor(config) {
    this.config = config;
  }

  async spinUp(taskDescription, options = {}) {
    // Handle backwards compatibility for spinUp(taskDescription, modelOverride, channel, userId, sessionId)
    let opts =
      typeof options === "string" || options === null
        ? {
            modelOverride: arguments[1] || null,
            channel: arguments[2] || "default",
            userId: arguments[3] || "local_user",
            sessionId: arguments[4] || "session-1",
            isSubagent: false,
            role: null
          }
        : options;
    const {
      modelOverride = null,
      providerOverride = null,
      channel = "default",
      userId = "local_user",
      sessionId = "session-1",
      isSubagent = false,
      role = null
    } = opts;

    const dbPath =
      this.config.memoryPath ||
      (this.config.projectName
        ? path.join(
            process.cwd(),
            ".jared",
            this.config.projectName,
            "memory.db"
          )
        : path.join(process.cwd(), ".jared", "memory.db"));
    const memory = new MemoryManager(dbPath);
    await memory.initialize();

    let customSoulPath = this.config.soulPath;
    let isTeamRole = false;

    if (isSubagent && role) {
      const safeRole = role.replace(/[^a-zA-Z0-9_-]/g, "");
      customSoulPath = path.resolve(
        process.cwd(),
        "src",
        "team",
        `${safeRole}.md`
      );
      isTeamRole = true;
    }

    // Workspace sandboxing
    const securityConfig = this.config.security || {};
    const workspaceDir = path.resolve(
      process.cwd(),
      securityConfig.workspaceDir ||
        (this.config.projectName
          ? `.jared/${this.config.projectName}/workspace`
          : ".jared/workspace")
    );
    if (securityConfig.restrictToWorkspace) {
      try {
        fs.mkdirSync(workspaceDir, { recursive: true });
      } catch (err) {
        if (err.code !== "EEXIST") throw err;
        const stat = fs.statSync(workspaceDir);
        if (!stat.isDirectory()) throw err;
      }
      securityConfig.workspaceDir = workspaceDir;
    }

    const context = new ContextManager(
      memory,
      customSoulPath,
      isTeamRole,
      securityConfig
    );

    const skills = new SkillsManager();
    const skillsDir = path.resolve(process.cwd(), "src", "skills");
    skills.loadSkillsFromDirectory(skillsDir, true);

    const execGuard = new ExecGuard(securityConfig);

    // Initialize MCP early to make it available to dynamic tools
    const mcp = new MCPManager(this.config.mcp);
    await mcp.initialize();

    // Dynamic Tool Loading
    const toolsDir = path.resolve(process.cwd(), "src", "tools");
    const runtimeContext = {
      config: this.config,
      memory,
      userId,
      sessionId,
      channel,
      execGuard,
      cronScheduler,
      bus,
      agentManager: this,
      mcp
    };

    await skills.loadToolsFromDirectory(toolsDir, runtimeContext, true);

    // === Run agent loop ===

    const provider = new ProviderRouter(
      this.config,
      providerOverride,
      modelOverride
    );

    let skillsContext = skills.getSkillsContext();
    let mcpContext = mcp.getMCPContext();

    let maxIterations = this.config.agents?.defaults?.maxIterations || 15;
    let actualTaskDescription = taskDescription;

    if (isSubagent) {
      maxIterations = Math.max(1, Math.floor(maxIterations / 2)); // Leaner loop for subagents
      actualTaskDescription = `[SUBAGENT MODE] You are running as a background subagent task. Be concise and focus strictly on completing the requested specific task without conversational padding.\n\nTask: ${taskDescription}`;
    }

    const agentLoop = new AgentLoop(
      context,
      memory,
      skills,
      mcp,
      provider,
      maxIterations
    );

    const onToken =
      channel === "console" && !isSubagent
        ? token => {
            bus.emit("message:stream", { channel, userId, sessionId, token });
          }
        : null;

    const result = await agentLoop.runTask(
      actualTaskDescription,
      sessionId,
      userId,
      skillsContext,
      mcpContext,
      onToken
    );
    const responseContent =
      typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content);
    const tokenUsage = result.usage;

    if (!isSubagent) {
      await memory.addMessage(sessionId, "user", taskDescription);
      await memory.addMessage(sessionId, "assistant", responseContent);
    }

    if (
      tokenUsage &&
      (tokenUsage.promptTokens > 0 || tokenUsage.completionTokens > 0)
    ) {
      await memory.addTokenUsage(
        sessionId,
        provider.activeProviderName || "unknown",
        provider.model || "unknown",
        tokenUsage.promptTokens,
        tokenUsage.completionTokens
      );
    }

    return { content: responseContent, usage: tokenUsage };
  }
}

export default AgentManager;
