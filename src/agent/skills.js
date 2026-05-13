import fs from "node:fs";
import path from "node:path";
class SkillsManager {
  constructor() {
    this.tools = [];
    this.handlers = new Map();
    this.skillInstructions = []; // Markdown instructions loaded from SKILL.md files
  }
  registerTool(toolSchema, handler) {
    this.tools.push({ type: "function", function: toolSchema });
    this.handlers.set(toolSchema.name, handler);
  }
  async loadSkillsFromDirectory(skillsDir, suppressLog = false) {
    if (!fs.existsSync(skillsDir)) return;
    const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });

    const loadPromises = entries.map(async (entry) => {
      if (!entry.isDirectory()) return null;
      const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) return null;
      try {
        const raw = await fs.promises.readFile(skillPath, "utf8");
        const parsed = this._parseFrontmatter(raw);
        if (parsed.name && parsed.body) {
          return {
            name: parsed.name,
            description: parsed.description || "",
            instructions: parsed.body,
            path: path.join(skillsDir, entry.name)
          };
        }
      } catch (e) {
        if (!suppressLog) {
          console.warn(
            `[Skills] Failed to load skill from ${skillPath}: ${e.message}`
          );
        }
      }
      return null;
    });

    const results = await Promise.all(loadPromises);
    for (const res of results) {
      if (res) this.skillInstructions.push(res);
    }
  }
  _parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { name: null, description: null, body: content };
    const body = match[2].trim();
    const fields = {};
    for (const line of match[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx).trim();
        let val = line.substring(colonIdx + 1).trim();
        if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
        fields[key] = val;
      }
    }
    return { name: fields.name || null, description: fields.description || null, body };
  }
  getSkillsContext() {
    if (this.skillInstructions.length === 0) return "";
    const sections = this.skillInstructions.map(skill => {
      return `- **${skill.name}**: ${skill.description ? skill.description : "No description available."}`;
    });

    const templatePath = path.join(process.cwd(), "src", "identity", "SKILLS.md");
    try {
      const template = fs.readFileSync(templatePath, "utf8");
      return template.replace("{{skills}}", sections.join("\n"));
    } catch (err) {
      return `\n## Available Skills\nYou have the following skills available. Use the \`read_skill_manual\` tool to read the full instructions for any of these skills before using them:\n${sections.join("\n")}\n`;
    }
  }
  async loadToolsFromDirectory(toolsDir, runtimeContext, suppressLog = false) {
    if (!fs.existsSync(toolsDir)) return;
    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
    const importPromises = entries.map(async (entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".js")) return null;
      const toolPath = path.join(toolsDir, entry.name);
      try { const module = await import("file://" + toolPath); return { module, toolPath }; } catch (e) { if (!suppressLog) { console.warn(`[Tools] Failed to load tool from ${toolPath}: ${e.message}`); } return null; }
    });
    const results = await Promise.all(importPromises);
    let loadedCount = 0;
    for (const result of results) {
      if (!result) continue;
      const { module } = result;
      const toolsToLoad = Array.isArray(module.default) ? module.default : [module.default];
      for (const t of toolsToLoad) {
        if (t && t.schema && t.execute) { this.registerTool(t.schema, (args) => t.execute(args, runtimeContext)); loadedCount++; }
      }
    }
  }
  getTools() { return this.tools; }
  async executeTool(name, argsJson) {
    try {
      const handler = this.handlers.get(name);
      if (!handler) { throw new Error(`Tool ${name} not found.`); }
      const args = JSON.parse(argsJson);
      return await handler(args);
    } catch (error) { return { error: error.message }; }
  }
}
export default SkillsManager;
