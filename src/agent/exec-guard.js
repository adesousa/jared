import readline from "node:readline";
import bus from "../bus/index.js";

const DEFAULT_ALLOWED_BINS = [
  "curl", "gh", "summarize", "crontab", "echo", "cat", "grep",
  "head", "tail", "wc", "date", "uname", "whoami", "pwd", "ls", "find",
  "jq", "sort", "uniq", "awk", "sed", "tr", "npx", "node", "bun",
  "python3", "python", "git", "mkdir", "touch", "cp"
];

const BLOCKED_PATTERNS = [
  /rm\s+(-\w*r\w*|-\w*f\w*|--recursive|--force)/i, /rm\s+-\w*R/i, /mkfs/i, /dd\s+if=/i,
  />\s*\/(?:etc|dev|sys|proc)\//, /chmod\s+777/, /curl\s.*\|\s*(bash|sh|zsh|eval)/i,
  /wget\s.*\|\s*(bash|sh|zsh|eval)/i, /\beval\s/, /\bsudo\s/, /\bsu\s+-/, /:(){ :|:& };:/,
  />\s*\/dev\/[sh]d[a-z]/, /shutdown|reboot|halt|poweroff/i, /\bkill\s+-9\s+1\b/, /history\s*-c/
];

const SAFE_SYSTEM_PATHS = [ "/dev/null", "/tmp", "/usr/bin", "/usr/local/bin", "/bin" ];

class ExecGuard {
  constructor(securityConfig = {}) {
    const exec = securityConfig.exec || {};
    this.mode = exec.mode || "confirm";
    this.allowedBins = exec.allowedBins || DEFAULT_ALLOWED_BINS;
    this.blockedPatterns = BLOCKED_PATTERNS;
    this.restrictToWorkspace = securityConfig.restrictToWorkspace || false;
    this.workspaceDir = securityConfig.workspaceDir || null;
  }

  async validate(command) {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `🚫 Blocked: dangerous pattern (${pattern})`
        };
      }
    }
    if (this.restrictToWorkspace && this.workspaceDir) {
      const wsCheck = this._checkWorkspaceRestriction(command);
      if (!wsCheck.allowed) return wsCheck;
    }
    if (this.mode === "unrestricted") return { allowed: true };
    if (this.mode === "allowlist" || this.mode === "confirm") {
      const segments = command.split(/[|&;]/).map(s => s.trim());
      for (const segment of segments) {
        if (!segment) continue;
        const tokens = segment.split(/\s+/);
        let bin = null;
        for (const token of tokens) {
          if (token.includes("=") && !token.startsWith("-")) continue;
          bin = token;
          break;
        }
        if (bin && !this.allowedBins.includes(bin)) {
          return {
            allowed: false,
            reason: `🚫 Blocked: "${bin}" not in allowed list`
          };
        }
      }
    }
    if (this.mode === "confirm") {
      const approved = await this._askUserConfirmation(command);
      if (!approved)
        return { allowed: false, reason: "🚫 Command rejected by user." };
    }
    return { allowed: true };
  }

  _checkWorkspaceRestriction(command) {
    if (/\.\.[\\/]/.test(command)) {
      return {
        allowed: false,
        reason:
          "🚫 Blocked: path traversal (../) not allowed in workspace-restricted mode."
      };
    }
    const absPathMatch = command.match(/(?:^|\s)(\/[^\s]+)/g);
    if (absPathMatch) {
      for (const match of absPathMatch) {
        const absPath = match.trim();
        const isSafe = SAFE_SYSTEM_PATHS.some(sp => absPath.startsWith(sp));
        if (!isSafe && !absPath.startsWith(this.workspaceDir)) {
          return {
            allowed: false,
            reason: `🚫 Blocked: "${absPath}" outside workspace (${this.workspaceDir})`
          };
        }
      }
    }
    return { allowed: true };
  }

  getWorkspaceCwd() {
    return this.restrictToWorkspace && this.workspaceDir
      ? this.workspaceDir
      : null;
  }

  _askUserConfirmation(command) {
    return new Promise(resolve => {
      const payload = {
        promptText: `\n🔒 [EXEC GUARD] Jared wants to run:\n   $ ${command}\n   Allow? (y/n): `,
        handled: false,
        callback: answer => {
          const a = answer.trim().toLowerCase();
          resolve(a === "y" || a === "yes");
        }
      };

      bus.emit("console:question", payload);

      if (!payload.handled) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stderr
        });
        rl.question(payload.promptText, answer => {
          rl.close();
          payload.callback(answer);
        });
      }
    });
  }
}

export default ExecGuard;
