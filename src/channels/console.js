import readline from "node:readline";
import bus from "../bus/index.js";
import sessionManager from "../session/index.js";
import { logger } from "../utils/index.js";

const PURPLE = "\x1b[38;5;141m";
const WHITE = "\x1b[97m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const BANNER = `${PURPLE}${BOLD}\n     ██╗ █████╗ ██████╗ ███████╗██████╗ \n     ██║██╔══██╗██╔══██╗██╔════╝██╔══██╗\n     ██║███████║██████╔╝█████╗  ██║  ██║\n██   ██║██╔══██║██╔══██╗██╔══╝  ██║  ██║\n╚█████╔╝██║  ██║██║  ██║███████╗██████╔╝\n ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ \n${RESET}${DIM}  Your AI COO · Type "exit" to quit${RESET}\n`;

class StreamMarkdownLexer {
  constructor(writeFn) {
    this.write = writeFn;
    this.buffer = '';
    this.isBold = false;
    this.isItalic = false;
    this.isCodeBlock = false;
    this.inTable = false;
    this.tableLines = [];
    
    // ANSI formatters
    this.fmt = {
      reset: RESET,
      bold: BOLD,
      italic: "\x1b[3m",
      cyan: "\x1b[36m",
      magenta: PURPLE,
      blue: "\x1b[34m",
      green: GREEN,
      dim: DIM,
      white: WHITE
    };

    this.atLineStart = true;
  }

  reset() {
     this.buffer = '';
     this.isBold = false;
     this.isItalic = false;
     this.isCode = false;
     this.isCodeBlock = false;
     this.atLineStart = true;
     this.inTable = false;
     this.tableLines = [];
  }

  getStateFmt() {
     let fmt = this.fmt.reset + this.fmt.white;
     if (this.isBold) fmt += this.fmt.bold;
     if (this.isItalic) fmt += this.fmt.italic;
     if (this.isCode) fmt += this.fmt.cyan;
     return fmt;
  }

  push(chunk) {
    this.buffer += chunk;
    this.process();
  }

  process() {
    let out = "";
    let i = 0;

    while (i < this.buffer.length) {
      const char = this.buffer[i];
      const nextChar = this.buffer[i + 1];

      // ------ Table Buffering Logic ------
      if (this.atLineStart && !this.isCodeBlock) {
         let p = i;
         while (p < this.buffer.length && this.buffer[p] === ' ') p++;
         
         if (p === this.buffer.length) {
             break;
         }
         
         if (this.buffer[p] === '|') {
            let nlIndex = this.buffer.indexOf('\n', p);
            if (nlIndex === -1) {
               break; 
            }
            
            this.inTable = true;
            const rowStr = this.buffer.slice(i, nlIndex + 1);
            this.tableLines.push(rowStr);
            i = nlIndex + 1;
            continue; 
         } else {
            if (this.inTable) {
               out += this.formatTable(this.tableLines);
               this.tableLines = [];
               this.inTable = false;
            }
         }
      }
      // -----------------------------------

      if (char === '\n') {
         out += this.fmt.reset + char;
         this.atLineStart = true;
         i++;
         if (!this.isCodeBlock) {
             out += this.getStateFmt();
         } else {
             out += this.fmt.cyan;
         }
         continue;
      }

      if (this.atLineStart && char === '#') {
         let p = i + 1;
         let hashes = 1;
         while (p < this.buffer.length && this.buffer[p] === '#') { hashes++; p++; }
         if (p < this.buffer.length && (this.buffer[p] === ' ' || this.buffer[p] === '\n')) {
            if (this.buffer[p] === ' ') {
              out += this.fmt.magenta + this.fmt.bold + "■ ".repeat(hashes);
              i = p + 1;
            } else {
              out += this.fmt.magenta + this.fmt.bold + "■ ".repeat(hashes);
              i = p;
            }
            this.atLineStart = false;
            out += this.fmt.magenta + this.fmt.bold; 
            continue;
         } else if (p === this.buffer.length) {
            break; 
         }
      }

      if (char === '`' && nextChar === '`' && this.buffer[i+2] === '`') {
         if (i + 2 >= this.buffer.length) break;
      } else if (char === '`' && nextChar === '`' && !this.isCodeBlock) {
         if (i + 2 >= this.buffer.length) break; 
      }

      if (char === '`' && nextChar === '`' && this.buffer[i+2] === '`') {
         this.isCodeBlock = !this.isCodeBlock;
         out += this.isCodeBlock ? (this.fmt.reset + this.fmt.cyan) : this.getStateFmt();
         i += 3;
         this.atLineStart = false;
         continue;
      }

      if (char === '`' && !this.isCodeBlock) {
         this.isCode = !this.isCode;
         out += this.getStateFmt();
         i++;
         this.atLineStart = false;
         continue;
      }

      if (char === '*' && nextChar === '*') {
         this.isBold = !this.isBold;
         out += this.getStateFmt();
         i += 2;
         this.atLineStart = false;
         continue;
      }
      
      if (char === '*' && i + 1 === this.buffer.length) {
         break;
      }

      if (char === '*') {
         if (this.atLineStart && nextChar === ' ') {
            out += this.fmt.green + "● " + this.getStateFmt();
            i += 2;
            this.atLineStart = false;
            continue;
         } else {
            this.isItalic = !this.isItalic;
            out += this.getStateFmt();
            i++;
            this.atLineStart = false;
            continue;
         }
      }
      
      if (this.atLineStart && char === '-') {
         if (nextChar === ' ') {
            out += this.fmt.green + "● " + this.getStateFmt();
            i += 2;
            this.atLineStart = false;
            continue;
         } else if (i + 1 === this.buffer.length) {
            break;
         }
      }

      if (char === '[') {
         out += this.fmt.cyan + char;
         i++;
         this.atLineStart = false;
         continue;
      }
      if (char === ']') {
         out += char + this.getStateFmt();
         i++;
         this.atLineStart = false;
         continue;
      }
      if (char === '(' && this.buffer[i-1] === ']') {
         out += this.fmt.dim + this.fmt.blue + char;
         i++;
         this.atLineStart = false;
         continue;
      }
      if (char === ')' && this.buffer.lastIndexOf('(') > this.buffer.lastIndexOf('\n')) {
         out += char + this.getStateFmt();
         i++;
         this.atLineStart = false;
         continue;
      }

      out += char;
      this.atLineStart = false;
      i++;
    }

    this.buffer = this.buffer.slice(i);
    if (out) this.write(out);
  }

  flush() {
    if (this.buffer) {
       let trimmed = this.buffer.trimStart();
       if (this.inTable || (this.atLineStart && trimmed.startsWith('|'))) {
           this.tableLines.push(this.buffer);
           this.write(this.formatTable(this.tableLines));
           this.inTable = false;
           this.tableLines = [];
       } else {
           if (this.inTable) {
               this.write(this.formatTable(this.tableLines));
               this.inTable = false;
               this.tableLines = [];
           }
           this.write(this.buffer);
       }
       this.buffer = '';
    } else if (this.inTable && this.tableLines.length > 0) {
       this.write(this.formatTable(this.tableLines));
       this.inTable = false;
       this.tableLines = [];
    }
  }

  formatTable(lines) {
     const rows = [];
     let maxCols = 0;
     for (const line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
        const cells = trimmed.split('|').map(c => c.trim());
        maxCols = Math.max(maxCols, cells.length);
        rows.push({ original: line, cells });
     }

     let hasSeparator = false;
     if (rows.length > 1) {
        hasSeparator = rows[1].cells.every(c => /^[-: ]+$/.test(c) && c.length > 0);
     }

     const colWidths = new Array(maxCols).fill(0);
     for (let i = 0; i < rows.length; i++) {
        if (hasSeparator && i === 1) continue;
        for (let j = 0; j < rows[i].cells.length; j++) {
           let cell = rows[i].cells[j];
           let visibleLen = cell.replace(/\*\*|\*|`/g, '').length;
           colWidths[j] = Math.max(colWidths[j] || 0, visibleLen);
        }
     }

     let result = "";
     let top = this.fmt.dim + "┌" + colWidths.map(w => "─".repeat(w + 2)).join("┬") + "┐" + this.getStateFmt() + "\n";
     result += top;

     for (let i = 0; i < rows.length; i++) {
        if (hasSeparator && i === 1) {
           result += this.fmt.dim + "├" + colWidths.map(w => "─".repeat(w + 2)).join("┼") + "┤" + this.getStateFmt() + "\n";
           continue;
        }

        let rowStr = this.fmt.dim + "│" + this.getStateFmt() + " ";
        for (let j = 0; j < colWidths.length; j++) {
           let cell = rows[i].cells[j] || "";
           let visibleLen = cell.replace(/\*\*|\*|`/g, '').length;
           let padLen = Math.max(0, colWidths[j] - visibleLen);
           
           let formattedCell = cell
              .replace(/\*\*(.*?)\*\*/g, this.fmt.bold + "$1" + this.getStateFmt())
              .replace(/\*(.*?)\*/g, this.fmt.italic + "$1" + this.getStateFmt())
              .replace(/`(.*?)`/g, this.fmt.cyan + "$1" + this.getStateFmt());
              
           rowStr += formattedCell + " ".repeat(padLen);
           
           if (j < colWidths.length - 1) {
              rowStr += this.fmt.dim + " │" + this.getStateFmt() + " ";
           } else {
              rowStr += " " + this.fmt.dim + "│" + this.getStateFmt();
           }
        }
        result += rowStr + "\n";
     }

     let bottom = this.fmt.dim + "└" + colWidths.map(w => "─".repeat(w + 2)).join("┴") + "┘" + this.getStateFmt() + "\n";
     result += bottom;
     return result;
  }
}

class ConsoleChannel {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.rl = null;
    this.isStreaming = false;
    this.lexer = new StreamMarkdownLexer(chars => process.stdout.write(chars));
    
    this.spinnerInterval = null;
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerFrameIdx = 0;
    this.activeSubagents = 0;
    this.spinnerText = null;
  }

  startSpinner(text = "Thinking...") {
    this.stopSpinner();
    if (!process.stdout.isTTY) return;
    this.spinnerInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`   ${PURPLE}${this.spinnerFrames[this.spinnerFrameIdx]}${RESET} ${DIM}${text}${RESET}`);
      this.spinnerFrameIdx = (this.spinnerFrameIdx + 1) % this.spinnerFrames.length;
    }, 80);
  }

  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
    }
  }

  updatePrompt() {
    if (!this.rl) return;
    const defaultPrompt = `${PURPLE}❯ ${RESET}`;
    if (this.activeSubagents > 0) {
      const taskWord = this.activeSubagents === 1 ? 'task' : 'tasks';
      this.rl.setPrompt(`${DIM}(${this.activeSubagents} active ${taskWord})${RESET} ${defaultPrompt}`);
    } else {
      this.rl.setPrompt(defaultPrompt);
    }
    // Only refresh if we are currently sitting at the prompt
    if (!this.isStreaming && !this.spinnerInterval) {
      this.rl.prompt(true);
    }
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
    logger.debug("Console channel interactive interface started.");

    bus.on("subagent:start", payload => {
      if (payload.channel === "console") {
        this.activeSubagents++;
        this.updatePrompt();
      }
    });

    bus.on("subagent:end", payload => {
      if (payload.channel === "console") {
        this.activeSubagents = Math.max(0, this.activeSubagents - 1);
        this.updatePrompt();
      }
    });

    bus.on("task:start", () => {
      console.log();
      this.startSpinner("Thinking...");
    });

    bus.on("task:end", () => {
      this.stopSpinner();
      // No prompt here, message:send will handle it
    });

    bus.on("tool:start", payload => {
      this.stopSpinner();
      
      let toolStr = payload.name;
      try {
        const args = typeof payload.args === 'string' ? JSON.parse(payload.args) : payload.args;
        if (args && typeof args === 'object' && Object.keys(args).length > 0) {
          let val = String(Object.values(args)[0]).replace(/\n/g, ' ');
          if (val.length > 40) val = val.substring(0, 37) + '...';
          toolStr = `${payload.name} (${val})`;
        }
      } catch (e) {}

        if (this.isStreaming) {
          this.lexer.flush();
          process.stdout.write(`\n\n   ${DIM}[Working] Executing tool: ${toolStr}${RESET}\n\n`);
        } else {
          console.log(`   ${DIM}[Working] Executing tool: ${toolStr}${RESET}`);
      }
      this.startSpinner("Working...");
    });

    this.rl.on("line", line => {
      process.stdout.write(RESET);
      const text = line.trim();
      logger.debug(`Received user input from console: "${text}"`);
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
        this.stopSpinner();
        if (!this.isStreaming) {
          process.stdout.write(`\n${BOLD}${WHITE}Jared:${RESET} `);
          this.isStreaming = true;
        }
        this.lexer.push(payload.token);
      }
    });
    // Listen for responses back from Jared destined for the console
    bus.on("message:send", payload => {
      if (payload.channel === "console") {
        logger.debug(`Sending response to console (Tokens: ${payload.usage ? JSON.stringify(payload.usage) : "N/A"}).`);
        this.stopSpinner();
        if (!this.isStreaming) {
          process.stdout.write(`\n${BOLD}${WHITE}Jared:${RESET} `);
          this.lexer.push(payload.content);
        }
        this.lexer.flush();
        this.lexer.reset();
        process.stdout.write("\n"); // Final newline to close the stream block
        this.isStreaming = false;
        // Display token usage if available
        if (payload.usage) {
          const { promptTokens, completionTokens } = payload.usage;
          const total = promptTokens + completionTokens;
          console.log();
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

    // Expose readline question prompt to other components (like ExecGuard) 
    // to prevent double-echo bugs caused by multiple interfaces on process.stdin
    bus.on("console:question", payload => {
      this.stopSpinner();
      payload.handled = true;
      this.rl.question(payload.promptText, answer => {
        payload.callback(answer);
        console.log();
        this.startSpinner("Thinking...");
      });
    });
  }
}

export default ConsoleChannel;
