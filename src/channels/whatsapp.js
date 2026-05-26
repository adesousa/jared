import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

// Helper functions for WhatsApp-specific Markdown and Table formatting
function formatTableToMonospace(lines) {
  const rows = [];
  let maxCols = 0;
  for (const line of lines) {
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.substring(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.substring(0, trimmed.length - 1);
    const cells = trimmed.split("|").map(c => c.trim());
    maxCols = Math.max(maxCols, cells.length);
    rows.push({ cells });
  }

  let hasSeparator = false;
  if (rows.length > 1) {
    hasSeparator = rows[1].cells.every(c => /^[-: ]+$/.test(c) && c.length > 0);
  }

  const colWidths = new Array(maxCols).fill(0);
  for (let i = 0; i < rows.length; i++) {
    if (hasSeparator && i === 1) continue;
    for (let j = 0; j < rows[i].cells.length; j++) {
      let cell = rows[i].cells[j] || "";
      let visibleLen = cell.replace(/\*\*|\*|`/g, "").length;
      colWidths[j] = Math.max(colWidths[j] || 0, visibleLen);
    }
  }

  let resultParts = [];
  let top = "┌" + colWidths.map(w => "─".repeat(w + 2)).join("┬") + "┐\n";
  resultParts.push(top);

  const prefix = "│ ";
  const separator = " │ ";
  const suffix = " │\n";
  const sepBorder = "├" + colWidths.map(w => "─".repeat(w + 2)).join("┼") + "┤\n";

  for (let i = 0; i < rows.length; i++) {
    if (hasSeparator && i === 1) {
      resultParts.push(sepBorder);
      continue;
    }

    let rowParts = [prefix];
    for (let j = 0; j < colWidths.length; j++) {
      let cell = rows[i].cells[j] || "";
      let cleanCell = cell.replace(/\*\*|\*|`/g, "");
      let visibleLen = cleanCell.length;
      let padLen = Math.max(0, colWidths[j] - visibleLen);

      rowParts.push(cleanCell);
      if (padLen > 0) rowParts.push(" ".repeat(padLen));

      if (j < colWidths.length - 1) {
        rowParts.push(separator);
      } else {
        rowParts.push(suffix);
      }
    }
    resultParts.push(rowParts.join(""));
  }

  let bottom = "└" + colWidths.map(w => "─".repeat(w + 2)).join("┴") + "┘";
  resultParts.push(bottom);

  return "```\n" + resultParts.join("") + "\n```";
}

function formatWhatsAppMarkdown(text) {
  if (!text) return text;
  let lines = text.split("\n");
  let formattedLines = [];
  let inTable = false;
  let tableLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      inTable = true;
      tableLines.push(line);
      continue;
    } else {
      if (inTable) {
        formattedLines.push(formatTableToMonospace(tableLines));
        tableLines = [];
        inTable = false;
      }
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const hashes = headerMatch[1].length;
      const title = headerMatch[2];
      formattedLines.push(`**${"■".repeat(hashes)} ${title}**`);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1];
      const content = listMatch[3];
      formattedLines.push(`${indent}• ${content}`);
      continue;
    }

    formattedLines.push(line);
  }

  if (inTable) {
    formattedLines.push(formatTableToMonospace(tableLines));
  }

  let result = formattedLines.join("\n");

  // Italic: *text* (not next to another *) -> _text_
  result = result.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "_$1_");

  // Bold: **text** -> *text*
  result = result.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Inline code: `code` -> ```code```
  result = result.replace(/(?<!`)`([^`\n]+)`(?!`)/g, "```$1```");

  return result;
}

class SessionState {
  constructor() {
    this.activeSubagents = 0;
    this.statusMsg = null;
    this.lastUserMsg = null;
    this.pendingQuestion = null;
    this.isStreaming = false;
    this.streamText = "";
    this.streamMsg = null;
    this.streamTimer = null;
    this.lastEditTime = 0;
    this.toolsRun = [];
  }
}

class WhatsAppChannel {
  constructor(config = {}) {
    this.enabled = config.enabled === true;
    this.client = null;
    this.sessions = new Map();
  }

  async updateProgressMessage(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.statusMsg) return;

    let text = `⏳ *Jared is working...*`;
    if (session.activeSubagents > 0) {
      const taskWord = session.activeSubagents === 1 ? 'task' : 'tasks';
      text += ` _(${session.activeSubagents} active background ${taskWord})_`;
    }

    if (session.toolsRun.length > 0) {
      const lastTool = session.toolsRun[session.toolsRun.length - 1];
      text += `\n• *Last tool:* \`${lastTool}\``;
    }

    try {
      await session.statusMsg.edit(text);
    } catch (e) {
      logger.error("WhatsApp edit progress message error:", e);
    }
  }

  throttleStreamEdit(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const now = Date.now();
    const waitTime = 1500;
    const timeSinceLastEdit = now - session.lastEditTime;

    if (session.streamTimer) {
      return;
    }

    const performEdit = async () => {
      session.streamTimer = null;
      session.lastEditTime = Date.now();
      
      const formatted = formatWhatsAppMarkdown(session.streamText);
      if (!session.streamMsg) {
        try {
          if (session.lastUserMsg) {
            session.streamMsg = await session.lastUserMsg.reply(formatted || "...");
          }
        } catch (e) {
          logger.error("WhatsApp create stream message error:", e);
        }
      } else {
        try {
          await session.streamMsg.edit(formatted || "...");
        } catch (e) {
          logger.error("WhatsApp edit stream message error:", e);
        }
      }
    };

    if (timeSinceLastEdit >= waitTime) {
      performEdit();
    } else {
      session.streamTimer = setTimeout(performEdit, waitTime - timeSinceLastEdit);
    }
  }

  start() {
    if (!this.enabled) return;
    this.client = new Client({ authStrategy: new LocalAuth() });

    this.client.on("qr", qr => {
      logger.info(
        "WhatsApp QR generated - please scan! (Use a QR terminal printer logic here)"
      );
    });

    this.client.on("ready", () => {
      logger.info("WhatsApp channel connected!");
    });

    this.client.on("message", async msg => {
      if (msg.from === "status@broadcast") return;
      
      const sessionId = sessionManager.getSessionId("whatsapp", msg.from);
      let session = this.sessions.get(sessionId);
      if (!session) {
        session = new SessionState();
        this.sessions.set(sessionId, session);
      }
      session.lastUserMsg = msg;

      if (session.pendingQuestion) {
        const callback = session.pendingQuestion;
        session.pendingQuestion = null;
        callback(msg.body);
        return;
      }

      bus.emit("message:received", {
        channel: "whatsapp",
        userId: msg.from,
        sessionId: sessionId,
        content: msg.body,
        meta: { msgObject: msg }
      });
    });

    // Subagent state tracking
    bus.on("subagent:start", payload => {
      if (payload.channel === "whatsapp") {
        const session = this.sessions.get(payload.sessionId);
        if (session) {
          session.activeSubagents++;
          this.updateProgressMessage(payload.sessionId);
        }
      }
    });

    bus.on("subagent:end", payload => {
      if (payload.channel === "whatsapp") {
        const session = this.sessions.get(payload.sessionId);
        if (session) {
          session.activeSubagents = Math.max(0, session.activeSubagents - 1);
          this.updateProgressMessage(payload.sessionId);
        }
      }
    });

    // Task and Tool execution progress
    bus.on("task:start", async payload => {
      if (!payload || !payload.sessionId) return;
      const session = this.sessions.get(payload.sessionId);
      if (session && session.lastUserMsg) {
        try {
          const chat = await session.lastUserMsg.getChat();
          await chat.sendStateTyping();
          
          session.toolsRun = [];
          const msg = await session.lastUserMsg.reply("⏳ *Jared is starting...*");
          session.statusMsg = msg;
        } catch (e) {
          logger.error("WhatsApp task:start error:", e);
        }
      }
    });

    bus.on("tool:start", async payload => {
      if (!payload || !payload.sessionId) return;
      const session = this.sessions.get(payload.sessionId);
      if (session) {
        let toolStr = payload.name;
        try {
          const args = typeof payload.args === 'string' ? JSON.parse(payload.args) : payload.args;
          if (args && typeof args === 'object' && Object.keys(args).length > 0) {
            let val = String(Object.values(args)[0]).replace(/\n/g, ' ');
            if (val.length > 30) val = val.substring(0, 27) + '...';
            toolStr = `${payload.name} (${val})`;
          }
        } catch (e) {}
        
        session.toolsRun.push(toolStr);
        this.updateProgressMessage(payload.sessionId);
      }
    });

    bus.on("task:end", async payload => {
      if (!payload || !payload.sessionId) return;
      const session = this.sessions.get(payload.sessionId);
      if (session) {
        try {
          if (session.lastUserMsg) {
            const chat = await session.lastUserMsg.getChat();
            await chat.clearState();
          }
          if (session.statusMsg) {
            let content = `✅ *Jared: Task complete*`;
            if (session.toolsRun.length > 0) {
              content += `\n\n*Executed tools:*\n` + session.toolsRun.map(t => `• \`${t}\``).join("\n");
            }
            await session.statusMsg.edit(content);
          }
        } catch (e) {
          logger.error("WhatsApp task:end error:", e);
        }
      }
    });

    // Stream token handling
    bus.on("message:stream", async payload => {
      if (payload.channel === "whatsapp") {
        const session = this.sessions.get(payload.sessionId);
        if (session) {
          session.isStreaming = true;
          session.streamText += payload.token;
          this.throttleStreamEdit(payload.sessionId);
        }
      }
    });

    // Send final message response
    bus.on("message:send", async payload => {
      if (payload.channel === "whatsapp") {
        const session = this.sessions.get(payload.sessionId);
        const formattedContent = formatWhatsAppMarkdown(payload.content);
        
        let header = "";
        if (payload.attempt === 1) {
          header = `*🤖 Jared (Initial Answer):*\n\n`;
        } else if (payload.attempt > 1) {
          header = `*🤖 Jared (Final Answer):*\n\n`;
        } else {
          header = `*🤖 Jared:*\n\n`;
        }

        let footer = "";
        if (payload.usage) {
          const { promptTokens, completionTokens } = payload.usage;
          const total = promptTokens + completionTokens;
          footer = `\n\n_⟡ ${promptTokens.toLocaleString()} input · ${completionTokens.toLocaleString()} output · ${total.toLocaleString()} total tokens_`;
        }

        const fullMsg = header + formattedContent + footer;

        try {
          if (session && session.streamMsg) {
            if (session.streamTimer) {
              clearTimeout(session.streamTimer);
              session.streamTimer = null;
            }
            await session.streamMsg.edit(fullMsg);
            session.streamMsg = null;
            session.isStreaming = false;
            session.streamText = "";
          } else {
            if (payload.meta?.msgObject) {
              await payload.meta.msgObject.reply(fullMsg);
            } else if (this.client) {
              // Fallback to sending to user ID if msgObject is not available
              await this.client.sendMessage(payload.userId, fullMsg);
            }
          }
        } catch (e) {
          logger.error("WhatsApp send error:", e);
        }
      }
    });

    // Interactive Question Confirmations (e.g. ExecGuard)
    bus.on("console:question", async payload => {
      if (payload.channel === "whatsapp") {
        payload.handled = true;
        const session = this.sessions.get(payload.sessionId);
        if (session) {
          try {
            const cleanPrompt = payload.promptText.replace(/\x1b\[[0-9;]*m/g, "").trim();
            const formattedPrompt = `🔒 *[EXEC GUARD]*\n${cleanPrompt}`;
            
            if (session.lastUserMsg) {
              await session.lastUserMsg.reply(formattedPrompt);
            } else if (this.client) {
              await this.client.sendMessage(payload.userId, formattedPrompt);
            }
            
            session.pendingQuestion = payload.callback;
          } catch (e) {
            logger.error("WhatsApp exec guard prompt error:", e);
            payload.callback("no");
          }
        }
      }
    });

    this.client.initialize();
  }
}

export { formatWhatsAppMarkdown, formatTableToMonospace };
export default WhatsAppChannel;
