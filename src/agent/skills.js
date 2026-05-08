import fs from "node:fs";
import path from "node:path";

class SkillsManager {
  constructor() {
    this.tools = [];
    this.handlers = new Map();
    this.skillInstructions = []; // Markdown instructions loaded from SKILL.md files
  }

  registerTool(toolSchema, handler) {
    this.tools.push({
      type: "function",
      function: toolSchema
    });
    this.handlers.set(toolSchema.name, handler);
  }

  // Scan a directory for skill folders containing SKILL.md files. Parses YAML frontmatter (name, description) and stores the markdown body as contextual instructions to be injected into the agent's system prompt.
  loadSkillsFromDirectory(skillsDir, suppressLog = false) {
    if (!fs.existsSync(skillsDir)) return;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      try {
        const raw = fs.readFileSync(skillPath, "utf8");
        const parsed = this._parseFrontmatter(raw);

        if (parsed.name && parsed.body) {
          this.skillInstructions.push({
            name: parsed.name,
            description: parsed.description || "",
            instructions: parsed.body,
            path: path.join(skillsDir, entry.name)
          });
        }
      } catch (e) {
        if (!suppressLog) {
          console.warn(
            `[Skills] Failed to load skill from ${skillPath}: ${e.message}`
          );
        }
      }
    }

    if (this.skillInstructions.length > 0 && !suppressLog) {
      console.log(
        `[Skills] Loaded ${this.skillInstructions.length} skill(s): ${this.skillInstructions.map(s => s.name).join(", ")}`
      );
    }
  }

  // Parse YAML frontmatter from a SKILL.md file
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

  // Build the skills context block to inject into the system prompt.
  getSkillsContext() {
    if (this.skillInstructions.length === 0) return "";

    const sections = this.skillInstructions.map(skill => {
      return `- **${skill.name}**: ${skill.description ? skill.description : "No description available."}`;
    });

    return `\n## Available Skills\nYou have the following skills available. Use the \`read_skill_manual\` tool to read the full instructions for any of these skills before using them:\n${sections.join("\n")}\n`;
  }

  // Scan a directory for JS files containing tool exports
  async loadToolsFromDirectory(toolsDir, runtimeContext, suppressLog = false) {
    if (!fs.existsSync(toolsDir)) return;

    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });

    const importPromises = entries.map(async (entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".js")) return null;

      const toolPath = path.join(toolsDir, entry.name);
      try {
        const module = await import("file://" + toolPath);
        return { module, toolPath };
      } catch (e) {
        if (!suppressLog) {
          console.warn(`[Tools] Failed to load tool from ${toolPath}: ${e.message}`);
        }
        return null;
      }
    });

    const results = await Promise.all(importPromises);
    let loadedCount = 0;

    for (const result of results) {
      if (!result) continue;
      const { module } = result;
      const toolsToLoad = Array.isArray(module.default) ? module.default : [module.default];

      for (const t of toolsToLoad) {
        if (t && t.schema && t.execute) {
          this.registerTool(t.schema, (args) => t.execute(args, runtimeContext));
          loadedCount++;
        }
      }
    }

    if (loadedCount > 0 && !suppressLog) {
      console.log(`[Tools] Loaded ${loadedCount} dynamic tool(s) from ${toolsDir}`);
    }
  }

  getTools() {
    return this.tools;
  }

  async executeTool(name, argsJson) {
    try {
      const handler = this.handlers.get(name);
      if (!handler) {
        throw new Error(`Tool ${name} not found.`);
      }
      const args = JSON.parse(argsJson);
      return await handler(args);
    } catch (error) {
      return { error: error.message };
    }
  }
}

export default SkillsManager;
