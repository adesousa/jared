import fs from "node:fs/promises";
import path from "node:path";

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), ".jared", "config.json");
    this.config = {};
  }

  async load() {
    try {
      this.config = JSON.parse(await fs.readFile(this.configPath, "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") { throw new Error(`Failed to read config: ${err.message}`); }
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      this.config = this._getDefaults();
      await this._save();
    }
    return this.config;
  }

  get(keyPath) {
    return keyPath.split(".").reduce((acc, part) => acc && acc[part], this.config);
  }

  async refresh() {
    this.config = this._deepMerge(this._getDefaults(), this.config);
    return await this._save();
  }

  async reset() {
    this.config = this._getDefaults();
    return await this._save();
  }

  async _save() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
    return this.config;
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && 
          target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        result[key] = this._deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  _getDefaults() {
    return {
      providers: {
        ollama: { url: "http://localhost:11434", keys: [{ name: "ollama-key", value: "ollama", models: ["qwen3:4b-instruct"] }] },
        openai: { url: "https://api.openai.com/v1", keys: [{ name: "openai-key", value: "", models: ["gpt-4o"] }] },
        gemini: { keys: [{ name: "gemini-key", value: "", models: ["gemini-2.0-flash"] }] },
        mistral: { url: "https://api.mistral.ai/v1", keys: [{ name: "mistral-key", value: "", models: ["mistral-medium"] }] },
        openrouter: { url: "https://openrouter.ai/api/v1", keys: [{ name: "openrouter-key", value: "", models: [] }] }
      },
      agents: { defaults: { provider: "ollama", model: "qwen3:4b-instruct", maxIterations: 15 } },
      heartbeat: { intervalMs: 30000 },
      mcp: { servers: {} },
      tools: { web: { search: { apiKey: "" } } },
      channels: {
        console: { enabled: true },
        discord: { enabled: false, token: "" },
        slack: { enabled: false, botToken: "", appToken: "" },
        telegram: { enabled: false, token: "" },
        whatsapp: { enabled: false },
        email: { enabled: false }
      },
      security: {
        restrictToWorkspace: false, workspaceDir: ".jared/workspace",
        exec: {
          mode: "confirm",
          allowedBins: ["curl", "gh", "summarize", "crontab", "echo", "cat", "grep", "head", "tail", "wc", "date", "uname", "whoami", "pwd", "ls", "find", "jq", "sort", "uniq", "awk", "sed", "tr", "npx", "node", "bun", "python3", "python", "git", "mkdir", "touch", "cp"]
        }
      },
      soulPath: path.resolve(process.cwd(), "src/identity/SOUL.md"),
      debug: false
    };
  }
}

export default ConfigManager;
