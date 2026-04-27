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
import HeartbeatManager from "../heartbeat/index.js";
import bus from "../bus/index.js";
import { logger, setDebug } from "../utils/index.js";
import cronScheduler from "../cron/index.js";

async function main() {
  const args = process.argv.slice(2);
  const options = {
    help: { type: "boolean", short: "h" }
  };

  const { values, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true
  });

  if (values.help || positionals.length === 0) {
    console.log("\nUsage: jared <command>\n\nCommands:\n  onboard       Initialize Jared config\n  start         Start Jared in interactive/channel listening mode\n  audit         Check dependencies for known vulnerabilities\n  lines         Count lines of code in the core agent\n  reset-memory  Reset the agent's memory database\n");
    process.exit(0);
  }

  const command = positionals[0];
  const configManager = new ConfigManager();
  const config = await configManager.load();

  if (command === "onboard") {
    const readline = await import("node:readline");
    const fs = await import("node:fs/promises");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const ask = q => new Promise(resolve => rl.question(q, resolve));
    const P = "\x1b[38;5;141m",
      B = "\x1b[1m",
      D = "\x1b[2m",
      R = "\x1b[0m",
      G = "\x1b[32m";

    console.log(`\n${P}${B}🧬 Jared Onboarding${R}\n`);
    const soulDir = path.join(process.cwd(), ".jared");
    await fs.mkdir(soulDir, { recursive: true });

    // #1: Config overwrite vs. refresh
    let configExists = false;
    try {
      await fs.access(configManager.configPath);
      configExists = true;
    } catch {}
    if (configExists) {
      console.log(`${D}  Config already exists at ${configManager.configPath}${R}\n` +
        `  ${P}y${R} = Overwrite with defaults (existing values will be lost)\n` +
        `  ${P}N${R} = Refresh config (keep existing values, add new fields)\n`);
      const overwrite = (await ask(`${P}Overwrite? (y/N):${R} `)).trim().toLowerCase();
      if (overwrite === "y" || overwrite === "yes") {
        await configManager.reset();
        console.log(`${G}✓${R} Config reset to defaults`);
      } else {
        await configManager.refresh();
        console.log(
          `${G}✓${R} Config refreshed (existing values preserved, new fields added)`
        );
      }
    } else {
      console.log(`${G}✓${R} Config created at ${configManager.configPath}`);
    }

    // Persona wizard
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
      } catch {
        /* use built-in fallback */
      }
      console.log(`\n${P}🎬${R} Jared Dunn persona activated!`);
    }
    console.log(`${D}   Soul saved to: .jared/SOUL.md (edit anytime)${R}`);

    // #2: Create HEARTBEAT.md template
    const hbPath = path.join(soulDir, "HEARTBEAT.md");
    try {
      await fs.access(hbPath);
    } catch {
      const hbTemplate = `# Heartbeat Schedule\n\n## One Shot Tasks\n\n## Daily Tasks\n### 6:45 AM — Morning Briefing\n- Check Google Calendar: list all events for today with times\n\n## Weekly Tasks\n### 5:00 PM Friday — Weekly Report\n- Pull this week's key metrics vs. last week\n\n## Monthly Tasks\n### 25th — Lead Alert\n- Check Accountability CRM\n`;
      await fs.writeFile(hbPath, hbTemplate, "utf8");
      console.log(`${G}✓${R} Created .jared/HEARTBEAT.md`);
    }

    // #4: Global Link
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
      } catch (e) {
        console.log(`\n${P}⚠${R} Failed to link command: ${e.message}`);
        console.log(`${D}   You can try running 'sudo bun link' manually.${R}`);
      }
    }

    // #5: Next Steps
    console.log(`\n${B}Next steps:${R}\n  1. Add your API key to ${P}.jared/config.json${R}`);
    if (linked) {
      console.log(`  2. Start chatting: ${P}jared start${R}`);
    } else {
      console.log(`  2. Start chatting: ${P}bun run jared${R} ${D}(or run 'bun link' to use 'jared' anywhere)${R}`);
    }
    console.log(`  3. Edit your persona: ${P}.jared/SOUL.md${R}\n  4. Add recurring tasks: ${P}.jared/HEARTBEAT.md${R}\n`);

    rl.close();
    process.exit(0);
  }

  if (["audit", "lines", "reset-memory", "stats"].includes(command)) {
    try {
      const { execSync } = await import("node:child_process");
      const cwd = process.cwd();
      if (command === "audit") {
        console.log("\n🔍 Running dependency security audit...\n");
        try { execSync("npm audit --audit-level=moderate", { encoding: "utf8", cwd, stdio: "inherit" });
        } catch (err) {
          if (err.status && err.status > 0) { console.log("\n⚠️  Vulnerabilities found. Run 'npm audit fix' to resolve."); }
        }
      } else if (command === "lines") { execSync("bash scripts/core_agent_lines.sh", { cwd, stdio: "inherit" });
      } else if (command === "reset-memory") { execSync("bash scripts/reset_memory.sh", { cwd, stdio: "inherit" });
      } else if (command === "stats") {
        const MemoryManager = (await import("../agent/memory.js")).default;
        const memory = new MemoryManager(path.join(cwd, ".jared", "memory.db"));
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
          console.log(`${D}Usage by Model${R}`);
          const maxModelLen = Math.max(...stats.byModel.map(m => m.model.length), 20);
          stats.byModel.forEach(m => {
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
    } catch (e) {
      console.error(`${command} failed:`, e.message);
    }
    process.exit(0);
  }

  if (command === "start") {
    const P = "\x1b[38;5;141m",
      B = "\x1b[1m",
      D = "\x1b[2m",
      R = "\x1b[0m",
      G = "\x1b[32m",
      Y = "\x1b[33m";

    // Channel status check at startup
    const provider = config.agents?.defaults?.provider || "unknown";
    const activeProvider = config.providers?.[provider];
    const model = config.agents?.defaults?.model || activeProvider?.keys?.[0]?.models?.[0] || "unknown";
    console.log(
      `${D}  Provider: ${R}${P}${provider}${R} ${D}| Model: ${R}${P}${model}${R}`
    );

    const enabledChannels = Object.entries(config.channels || {}).filter(([, v]) => v.enabled).map(([k]) => k);
    if (enabledChannels.length > 0) { console.log(`  ${G}✓${R} Channels: ${enabledChannels.join(", ")}`);
    } else { console.log(`  ${Y}⚠${R} No channels enabled`); }

    const cronCount = cronScheduler.jobs?.size || 0;
    const heartbeatIntervalMs = config.heartbeat?.intervalMs || 30000;
    console.log(
      `  ${G}✓${R} Cron: ${cronCount} job${cronCount !== 1 ? "s" : ""} | Heartbeat: ${heartbeatIntervalMs / 1000}s\n`
    );

    // Debug mode from config
    setDebug(config.debug === true);

    cronScheduler.start();

    const skillsDir = path.resolve(process.cwd(), "src", "skills");
    const startupSkills = new SkillsManager();
    startupSkills.loadSkillsFromDirectory(skillsDir);

    const heartbeatPath = path.join(process.cwd(), ".jared", "HEARTBEAT.md");
    const heartbeat = new HeartbeatManager(heartbeatPath, heartbeatIntervalMs);
    heartbeat.start();
    const agentManager = new AgentManager(config);

    bus.on("message:received", async payload => {
      try {
        const result = await agentManager.spinUp(
          payload.content,
          null,
          payload.channel,
          payload.userId,
          payload.sessionId
        );
        bus.emit("message:send", {
          channel: payload.channel,
          userId: payload.userId,
          sessionId: payload.sessionId,
          content: result.content,
          usage: result.usage,
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
    });

    bus.on("heartbeat", async ({ tasks }) => {
      const prompt = `[System Trigger] The following scheduled tasks are due NOW:\n${tasks.map(t => `- ${t}`).join("\n")}\n\nYour job is to strictly perform the action or immediately remind the user. Do not schedule them again using tools.`;
      try {
        const result = await agentManager.spinUp(
          prompt,
          null,
          "heartbeat",
          "system",
          "heartbeat"
        );
        if (result.content)
          logger.info(
            `[Heartbeat] Agent response: ${result.content.substring(0, 100)}...`
          );
      } catch (e) {
        logger.error("[Heartbeat] Agent error:", e);
      }
    });

    // Start all enabled channels
    const channelMap = {
      console: ConsoleChannel,
      telegram: TelegramChannel,
      discord: DiscordChannel,
      slack: SlackChannel,
      whatsapp: WhatsAppChannel
    };
    for (const [name, ChannelClass] of Object.entries(channelMap)) {
      const channelConfig = config.channels?.[name];
      if (channelConfig?.enabled) {
        const instance = new ChannelClass(channelConfig);
        instance.start();
      }
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
