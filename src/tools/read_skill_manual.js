import fs from "node:fs/promises";
import path from "node:path";

export default {
  schema: {
    name: "read_skill_manual",
    description: "Read the full markdown instructions from a skill's manual by providing its exact name.",
    parameters: {
      type: "object",
      properties: {
        skill_name: { type: "string", description: "The exact name of the skill (e.g., 'Docker')" }
      },
      required: ["skill_name"]
    }
  },
  execute: async ({ skill_name }) => {
    try {
      const skillsDir = path.resolve(process.cwd(), "src", "skills");
      let entries;
      try {
        entries = await fs.readdir(skillsDir, { withFileTypes: true });
      } catch {
        return `Error: Skills directory not found.`;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
        try {
          const content = await fs.readFile(skillPath, "utf8");
          const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          if (match) {
            const frontmatter = match[1];
            for (const line of frontmatter.split("\n")) {
              const colonIdx = line.indexOf(":");
              if (colonIdx !== -1) {
                const key = line.substring(0, colonIdx).trim();
                if (key === "name") {
                  let val = line.substring(colonIdx + 1).trim();
                  if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
                  if (val === skill_name) {
                    return `### Skill Manual: ${skill_name}\n\n${content}`;
                  }
                }
              }
            }
          }
        } catch {
          // Ignore read errors for individual skills
          continue;
        }
      }
      return `Error: Skill manual for '${skill_name}' not found. Please ensure you supply the exact name listed in Available Skills.`;
    } catch (e) {
      return `Error reading skill manual: ${e.message}`;
    }
  }
};
