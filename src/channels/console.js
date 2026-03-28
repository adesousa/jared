import readline from "node:readline";
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";

const PURPLE = "\x1b[38;5;141m";
const WHITE = "\x1b[97m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const BANNER = `${PURPLE}${BOLD}\n     ██╗ █████╗ ██████╗ ███████╗██████╗ \n     ██║██╔══██╗██╔══██╗██╔════╝██╔══██╗\n     ██║███████║██████╔╝█████╗  ██║  ██║\n██   ██║██╔══██║██╔══██╗██╔══╝  ██║  ██║\n╚█████╔╝██║  ██║██║  ██║███████╗██████╔╝\n ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ \n${RESET}${DIM}  Your AI COO · Type "exit" to quit${RESET}\n`;

class ConsoleChannel {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.rl = null;
    this.isStreaming = false;
  }

  start() {
    if (!this.enabled) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${PURPLE}❯ `
    });

    console.log(BANNER);
    this.rl.prompt();

    this.rl.on("line", line => {
      process.stdout.write(RESET);
      const text = line.trim();
      if (!text) {
        this.rl.prompt();
        return;
      }
      if (text.toLowerCase() === "exit" || text.toLowerCase() === "quit") {
        console.log(`\n${DIM}Goodbye.${RESET}\n`);
        process.exit(0);
      }
      const sessionId = sessionManager.getSessionId("console", "local_user");

      // Emit to the core agent loop
      bus.emit("message:received", {
        channel: "console",
        userId: "local_user",
        sessionId: sessionId,
        content: text
      });
    });

    bus.on("message:stream", payload => {
      if (payload.channel === "console") {
        if (!this.isStreaming) {
          process.stdout.write(`\n${BOLD}${WHITE}Jared:${RESET} `);
          this.isStreaming = true;
        }
        process.stdout.write(`${WHITE}${payload.token}${RESET}`);
      }
    });
    // Listen for responses back from Jared destined for the console
    bus.on("message:send", payload => {
      if (payload.channel === "console") {
        if (!this.isStreaming) {
          console.log(
            `\n${BOLD}${WHITE}Jared:${RESET} ${WHITE}${payload.content}${RESET}`
          );
        } else {
          console.log(); // Final newline to close the stream block
        }
        this.isStreaming = false;
        // Display token usage if available
        if (payload.usage) {
          const { promptTokens, completionTokens } = payload.usage;
          const total = promptTokens + completionTokens;
          console.log(
            `${DIM}${GREEN}   ⟡ ${promptTokens.toLocaleString()} input · ${completionTokens.toLocaleString()} output · ${total.toLocaleString()} total tokens${RESET}`
          );
        }
        // blank line before prompt
        console.log();
        this.rl.prompt();
      }
    });

    this.rl.on("close", () => {
      console.log(`\n${DIM}Goodbye.${RESET}\n`);
      process.exit(0);
    });

    // Coordinate with exec guard: pause readline so stdin doesn't leak
    bus.on("console:pause", () => this.rl.pause());
    bus.on("console:resume", () => this.rl.resume());
  }
}

export default ConsoleChannel;
