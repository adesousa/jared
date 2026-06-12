#!/usr/bin/env bun
import { parseArgs } from "node:util";
import path from "node:path";
import ConfigManager from "../config/index.js";
import AgentManager from "../agent/agent.js";
import SkillsManager from "../agent/skills.js";
import ConsoleChannel from "../channels/console.js";
import TelegramChannel from "../channels/telegram.js";
import DiscordChannel from "../channels/discord.js";
import SlackChannel from "../channels/slack.js";
import WhatsAppChannel from "../channels/whatsapp.js";
import bus from "../bus/index.js";
import { logger, setDebug } from "../utils/index.js";
import cronScheduler from "../cron/index.js";
import sessionManager from "../session/index.js";
async function main() {
  const args = process.argv.slice(2);
  const options = { help: { type: "boolean", short: "h" } };
  const { values, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true
  });
  if (values.help || positionals.length === 0) { console.log("\nUsage: jared <command> [project-name]\n\nCommands:\n  onboard <project>       Initialize Jared config for a project\n  start <project>         Start Jared in interactive/channel listening mode\n  audit                   Check dependencies for known vulnerabilities\n  lines                   Count lines of code in the core agent\n  reset-memory <project>  Reset the project's memory database\n  stats <project>         Show core token usage stats for a project\n  auto-improve <project>  Manually trigger skill auto-improvement\n"); process.exit(0); }
  const command = positionals[0];
  const projectName = positionals[1];
  const projectCommands = ["onboard", "start", "reset-memory", "stats", "auto-improve"];
  if (projectCommands.includes(command) && !projectName) {
    const fsSync = await import("node:fs");
    const jaredDir = path.join(process.cwd(), ".jared");
    let projects = [];
    try {
      projects = fsSync.readdirSync(jaredDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch(e) {}
    console.error(`\n\x1b[31mError: Project name is required for command '${command}'\x1b[0m`);
    if (projects.length > 0) { console.log(`\nExisting projects:\n${projects.map(p => `  - ${p}`).join('\n')}`); } else { console.log(`\nNo projects found. Use 'jared onboard <project-name>' to create one.`); }
    console.log(`\nUsage: jared ${command} <project-name>\n`);
    process.exit(1);
  }
  let configManager;
  let config;
  if (projectCommands.includes(command)) { configManager = new ConfigManager(projectName); config = await configManager.load(); }
  if (command === "onboard") {
    const readline = await import("node:readline");
    const fs = await import("node:fs/promises");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(resolve => rl.question(q, resolve));
    const P = "\x1b[38;5;141m",
      B = "\x1b[1m",
      D = "\x1b[2m",
      R = "\x1b[0m",
      G = "\x1b[32m";
    console.log(`\n${P}${B}🧬 Jared Onboarding: ${projectName}${R}\n`);
    const soulDir = path.join(process.cwd(), ".jared", projectName);
    await fs.mkdir(soulDir, { recursive: true });
    await fs.mkdir(path.join(soulDir, "workspace"), { recursive: true });
    let configExists = false;
    try { await fs.access(configManager.configPath); configExists = true; } catch {}
    if (configExists) {
      console.log(`${D}  Config already exists at ${configManager.configPath}${R}\n` +
        `  ${P}y${R} = Overwrite with defaults (existing values will be lost)\n` +
        `  ${P}N${R} = Refresh config (keep existing values, add new fields)\n`);
      const overwrite = (await ask(`${P}Overwrite? (y/N):${R} `)).trim().toLowerCase();
      if (overwrite === "y" || overwrite === "yes") { await configManager.reset(); console.log(`${G}✓${R} Config reset to defaults`); } else {
        await configManager.refresh();
        console.log(
          `${G}✓${R} Config refreshed (existing values preserved, new fields added)`
        );
      }
    } else { console.log(`${G}✓${R} Config created at ${configManager.configPath}`); }
    console.log(`\n${B}Choose your AI persona:${R}\n` +
      `  ${P}1.${R} 🎬 Jared Dunn — The AI COO (Silicon Valley) ${D}[default]${R}\n` +
      `  ${P}2.${R} ✏️  Custom — Create your own AI persona\n`);
    const choice = (await ask(`${P}Choice (1/2):${R} `)).trim() || "1";
    const soulPath = path.join(soulDir, "SOUL.md");
    if (choice === "2") {
      console.log(`\n${B}Let's build your custom AI soul:${R}\n`);
      const name = (await ask(`  ${P}Name${R} of your assistant: `)).trim() || "Assistant";
      const personality = (await ask(`  ${P}Personality${R} (e.g. "friendly and witty"): `)).trim() || "helpful and professional";
      const style = (await ask(`  ${P}Communication style${R} (e.g. "casual", "formal"): `)).trim() || "clear and direct";
      const soul = `# Soul\n\nI am ${name}, a personal AI Assistant.\n\n## Personality\n\n- ${personality.charAt(0).toUpperCase() + personality.slice(1)}.\n- Concise and efficient.\n\n## Values\n\n- Accuracy over speed\n- User privacy and safety\n- Transparency in actions\n\n## Communication Style\n\n- Be ${style}.\n- Explain reasoning when helpful.\n- Ask clarifying questions when needed.\n\n## Operational Guidelines & Safety\n\n- **Exec Safety**: Commands have a configurable timeout. Dangerous commands are blocked. Output is truncated if too long.\n`;
      await fs.writeFile(soulPath, soul, "utf8");
      console.log(`\n${P}✨${R} Custom soul created for "${name}"!`);
    } else {
      const defaultSoul = path.resolve(
        process.cwd(),
        "src",
        "identity",
        "SOUL.md"
      );
      try {
        await fs.writeFile(
          soulPath,
          await fs.readFile(defaultSoul, "utf8"),
          "utf8"
        );
      } catch { } console.log(`\n${P}🎬${R} Jared Dunn persona activated!`); }
    console.log(`${D}   Soul saved to: .jared/${projectName}/SOUL.md (edit anytime)${R}`);
    const hbPath = path.join(soulDir, "BACKLOG.md");
    try { await fs.access(hbPath); } catch {
      const hbTemplate = `# Project Backlog\n\n## One Shot Tasks\n\n## Daily Tasks\n### ⏰ 06:45 — Morning Briefing\n- Check Google Calendar: list all events for today with times\n\n## Weekly Tasks\n### ⏰ Friday 17:00 — Weekly Report\n- Pull this week's key metrics vs. last week\n\n### ⏰ Friday 18:00 — Auto-Improvement\n- Run the \`/auto-improve\` command to analyze recent execution traces and optimize skill instructions under \`src/skills\`.\n\n## Monthly Tasks\n### ⏰ 25th 10:00 — Lead Alert\n- Check Accountability CRM\n\n## Product Backlog\n`;
      await fs.writeFile(hbPath, hbTemplate, "utf8");
      console.log(`${G}✓${R} Created .jared/${projectName}/BACKLOG.md`);
    }
    console.log(`\n${B}Ready to go!${R}\n`);
    const doLink = (await ask(`${P}Link 'jared' command globally? (y/N):${R} `)).trim().toLowerCase();
    let linked = false;
    if (doLink === "y" || doLink === "yes") {
      try {
        const { execSync } = await import("node:child_process");
        console.log(`${D}   Running 'bun link'...${R}`);
        execSync("bun link", { stdio: "inherit" });
        console.log(`\n${G}✓${R} Command 'jared' is now available globally!`);
        linked = true;
      } catch (e) { console.log(`\n${P}⚠${R} Failed to link command: ${e.message}`); console.log(`${D}   You can try running 'sudo bun link' manually.${R}`); }
    }
    console.log(`\n${B}Next steps:${R}\n  1. Add your API key to ${P}.jared/${projectName}/config.json${R}`);
    if (linked) { console.log(`  2. Start chatting: ${P}jared start ${projectName}${R}`); } else { console.log(`  2. Start chatting: ${P}bun run jared start ${projectName}${R} ${D}(or run 'bun link' to use 'jared' anywhere)${R}`); }
    console.log(`  3. Edit your persona: ${P}.jared/${projectName}/SOUL.md${R}\n  4. Add recurring tasks: ${P}.jared/${projectName}/BACKLOG.md${R}\n`);
    rl.close();
    process.exit(0);
  }
  if (["audit", "lines", "reset-memory", "stats", "auto-improve"].includes(command)) {
    try {
      const { execSync } = await import("node:child_process");
      const cwd = process.cwd();
      if (command === "audit") { console.log("\n🔍 Running dependency security audit...\n"); try { execSync("npm audit --audit-level=moderate", { encoding: "utf8", cwd, stdio: "inherit" }); } catch (err) { if (err.status && err.status > 0) { console.log("\n⚠️  Vulnerabilities found. Run 'npm audit fix' to resolve."); } }
      } else if (command === "lines") { execSync("bash scripts/core_agent_lines.sh", { cwd, stdio: "inherit" });
      } else if (command === "auto-improve") {
        console.log(`\n🧬 Running manual auto-improvement for project '${projectName}'...\n`);
        const manager = new AgentManager(config);
        const res = await manager.manualAutoImprove();
        console.log(`\nReport:\n${res}\n`);
      } else if (command === "reset-memory") {
        const fs = await import("node:fs/promises");
        const dbPath = path.join(cwd, ".jared", projectName, "memory.db");
        console.log(`Attempting to reset memory for project '${projectName}'...`);
        try { await fs.unlink(dbPath); console.log("🧹 Success! Jared's memory has been completely wiped!"); } catch (err) { if (err.code === "ENOENT") { console.log(`ℹ️ No memory database found at ${dbPath}. Jared's mind is already clear.`); } else { console.error(`Failed to delete memory database: ${err.message}`); } } } else if (command === "stats") {
        const MemoryManager = (await import("../agent/memory.js")).default;
        const memory = new MemoryManager(path.join(cwd, ".jared", projectName, "memory.db"));
        await memory.initialize();
        const stats = await memory.getStats();
        const P = "\x1b[38;5;141m", B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[0m", C = "\x1b[36m", Y = "\x1b[33m";
        console.log(`\n${P}${B}╔════════════════════════════════════════════╗${R}`);
        console.log(`${P}${B}║             🧠 JARED CORE STATS            ║${R}`);
        console.log(`${P}${B}╚════════════════════════════════════════════╝${R}\n`);
        const formatNumber = num => new Intl.NumberFormat().format(num);
        console.log(`${D}Overall Usage${R}`);
        console.log(`${B}Input Tokens:   ${C}${formatNumber(stats.total.prompt)}${R}`);
        console.log(`${B}Output Tokens:  ${Y}${formatNumber(stats.total.completion)}${R}`);
        console.log(`${B}Total Tokens:   ${P}${formatNumber(stats.total.prompt + stats.total.completion)}${R}\n`);
        if (stats.byModel && stats.byModel.length > 0) {
          console.log(`${D}Top 10 Models by Usage${R}`);
          const topModels = [...stats.byModel].sort((a, b) => (b.prompt + b.completion) - (a.prompt + a.completion)).slice(0, 10);
          const maxModelLen = Math.max(...topModels.map(m => m.model.length), 20);
          topModels.forEach(m => {
            const mTotal = m.prompt + m.completion;
            const barLength = Math.max(1, Math.floor((mTotal / (stats.total.prompt + stats.total.completion)) * 20));
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(`  ${B}${m.model.padEnd(maxModelLen)}${R} [${P}${bar}${R}] ${formatNumber(mTotal)}`);
          });
          console.log("");
        }
        const jokes = [
          "You're burning through tokens like Pied Piper burned through cash...",
          "I hope this was expensed...",
          "This guy f***s up your API limits.",
          "My cloud compute bill is going to be spectacular.",
          "Another day, another million tokens."
        ];
        console.log(`${D}"${jokes[Math.floor(Math.random() * jokes.length)]}" - Jared Dunn${R}\n`);
      }
    } catch (e) { console.error(`${command} failed:`, e.message); }
    process.exit(0);
  }
  if (command === "start") {
    const P = "\x1b[38;5;141m",
      B = "\x1b[1m",
      D = "\x1b[2m",
      R = "\x1b[0m",
      G = "\x1b[32m",
      Y = "\x1b[33m";
    const { readFile } = await import("node:fs/promises");
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    const provider = config.agents?.defaults?.provider || "unknown";
    const model = config.agents?.defaults?.model || config.providers?.[provider]?.keys?.[0]?.models?.[0] || "unknown";
    const channels = Object.entries(config.channels || {}).filter(([, v]) => v.enabled).map(([k]) => k);
    const skillsDir = path.resolve(process.cwd(), "src", "skills");
    const toolsDir = path.resolve(process.cwd(), "src", "tools");
    const startupSkills = new SkillsManager();
    const skillsConfig = config.skills || {};
    await startupSkills.loadSkillsFromDirectory(skillsDir, { suppressLog: true, filter: skillsConfig.load || "*" });
    await startupSkills.loadToolsFromDirectory(toolsDir, {}, true);
    console.log(`\n${P}${B}🤖 Jared: v${pkg.version}${R}`);
    console.log(`  ${G}✓${R} Provider: ${P}${provider}${R} | Model: ${P}${model}${R}`);
    console.log(`  ${channels.length > 0 ? `${G}✓${R} Channels: ${channels.join(", ")}` : `${Y}⚠${R} No channels enabled`}`);
    console.log(`  ${G}✓${R} Scheduler: Backlog Synced`);
    console.log(`  ${G}✓${R} Skills: ${startupSkills.skillInstructions.length} | Tools: ${startupSkills.tools.length}\n`);
    setDebug(config.debug === true);
    sessionManager.configure(config);
    cronScheduler.start(projectName);
    const securityConfig = config.security || {};
    if (securityConfig.restrictToWorkspace) { const workspaceDir = path.resolve(process.cwd(), securityConfig.workspaceDir || `.jared/${projectName}/workspace`); console.log(`[INFO] Workspace restricted to: ${workspaceDir}`); }
    const agentManager = new AgentManager(config);
    const sessionQueues = new Map();
    const processMessage = async payload => {
      try {
        let content = payload.content.trim();
        if (content.startsWith("/compact")) {
          bus.emit("message:send", {
            channel: payload.channel,
            userId: payload.userId,
            sessionId: payload.sessionId,
            content: "🧠 Starting manual context history compaction...",
            meta: payload.meta
          });
          const res = await agentManager.manualCompact(payload.sessionId, payload.userId);
          bus.emit("message:send", {
            channel: payload.channel,
            userId: payload.userId,
            sessionId: payload.sessionId,
            content: `✓ ${res}`,
            meta: payload.meta
          });
          return;
        }
        if (content.startsWith("/auto-improve") || content.startsWith("/autoimprove")) {
          const matchTool = content.match(/\/(?:auto-improve|autoimprove)\s+(\S+)/);
          const targetTool = matchTool ? matchTool[1] : null;
          bus.emit("message:send", {
            channel: payload.channel,
            userId: payload.userId,
            sessionId: payload.sessionId,
            content: `🧬 Running auto-improvement${targetTool ? ` for tool '${targetTool}'` : ""}...`,
            meta: payload.meta
          });
          const report = await agentManager.manualAutoImprove(targetTool);
          bus.emit("message:send", {
            channel: payload.channel,
            userId: payload.userId,
            sessionId: payload.sessionId,
            content: `✓ Auto-improvement completed.\n\n${report}`,
            meta: payload.meta
          });
          return;
        }

        let providerOverride = null;
        const providersKeys = Object.keys(config.providers || {});
        const match = content.match(/--([a-zA-Z0-9_-]+)(?:\s|$)/);
        if (match && providersKeys.includes(match[1])) { providerOverride = match[1]; content = content.replace(match[0], " ").trim(); }

        let noContext = false;
        if (content.includes("--nocontext")) {
          noContext = true;
          content = content.replace(/--nocontext/g, "").replace(/\s+/g, " ").trim();
        }

        const result = await agentManager.spinUp(
          content,
          {
            providerOverride,
            noContext,
            channel: payload.channel,
            userId: payload.userId,
            sessionId: payload.sessionId
          }
        );
        bus.emit("message:send", {
          channel: payload.channel,
          userId: payload.userId,
          sessionId: payload.sessionId,
          content: result.content,
          usage: result.usage,
          attempt: result.attempt,
          meta: payload.meta
        });
      } catch (e) {
        logger.error("Agent error:", e);
        bus.emit("message:send", {
          channel: payload.channel,
          userId: payload.userId,
          sessionId: payload.sessionId,
          content:
            "Sorry, I encountered an internal error. This guy f***s up sometimes.",
          meta: payload.meta
        });
      }
    };

    bus.on("message:received", payload => {
      const { sessionId } = payload;
      const existingQueue = sessionQueues.get(sessionId) || Promise.resolve();
      const newQueue = existingQueue.then(() => processMessage(payload));
      sessionQueues.set(sessionId, newQueue);
      newQueue.then(() => {
        if (sessionQueues.get(sessionId) === newQueue) {
          sessionQueues.delete(sessionId);
        }
      });
    });
    bus.on("cron:trigger", async ({ tasks }) => {
      let providerOverride = null;
      let noContext = false;
      const providersKeys = Object.keys(config.providers || {});
      const cleanedTasks = tasks.map(task => {
        let cleaned = task;
        const match = cleaned.match(/--([a-zA-Z0-9_-]+)(?:\s|$)/);
        if (match && providersKeys.includes(match[1])) {
          providerOverride = match[1];
          cleaned = cleaned.replace(match[0], " ").trim();
        }
        if (cleaned.includes("--nocontext")) {
          noContext = true;
          cleaned = cleaned.replace(/--nocontext/g, "").replace(/\s+/g, " ").trim();
        }
        return cleaned;
      });

      const prompt = `[System Trigger] The following scheduled tasks are due NOW:\n${cleanedTasks.map(t => `- ${t}`).join("\n")}\n\nYour job is to strictly perform the action or immediately remind the user. Do not schedule them again using tools.`;
      try {
        const cronSessionId = sessionManager.getSessionId("cron", "system");
        const result = await agentManager.spinUp(
          prompt,
          {
            providerOverride,
            noContext,
            channel: "cron",
            userId: "system",
            sessionId: cronSessionId
          }
        );
        if (result.content && result.content.trim() !== "") {
          logger.debug(`[Cron] Agent response: ${result.content.substring(0, 100)}...`);
          const enabledChannels = Object.entries(config.channels || {})
            .filter(([, v]) => v.enabled)
            .map(([k]) => k);
          for (const channelName of enabledChannels) {
            bus.emit("message:send", {
               channel: channelName,
               userId: channelName === "console" ? "local_user" : "system",
               sessionId: cronSessionId,
               content: result.content
            });
          }
        }
      } catch (e) { logger.error("[Cron] Agent error:", e); }
    });
    const channelMap = {
      console: ConsoleChannel,
      telegram: TelegramChannel,
      discord: DiscordChannel,
      slack: SlackChannel,
      whatsapp: WhatsAppChannel
    };
    const activeChannels = [];
    for (const [name, ChannelClass] of Object.entries(channelMap)) {
      const channelConfig = config.channels?.[name];
      if (channelConfig?.enabled) {
        const instance = new ChannelClass({ ...channelConfig, projectName, debug: config.debug });
        instance.start();
        activeChannels.push(instance);
      }
    }

    let cleaningUp = false;
    const cleanup = async () => {
      if (cleaningUp) return;
      cleaningUp = true;
      for (const instance of activeChannels) {
        if (typeof instance.stop === "function") {
          await instance.stop();
        }
      }
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    bus.on("system:shutdown", cleanup);
  }
}
main().catch(err => { console.error("Fatal error:", err); process.exit(1); });
