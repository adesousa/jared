import fs from "node:fs/promises";
import path from "node:path";
import ProviderRouter from "../providers/router.js";
import { logger } from "../utils/index.js";

export default {
  schema: {
    name: "auto_improve",
    description: "Analyze recent failed tool traces and update SKILL.md documentation to prevent similar errors in the future.",
    parameters: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "Optional tool/skill name to focus on." }
      }
    }
  },
  execute: async ({ toolName }, context) => {
    const { memory, config } = context;
    if (!memory || !memory.db) {
      return "Error: Memory database not initialized or unavailable in context.";
    }
    const db = memory.db;
    
    // Fetch failed traces
    let query = "SELECT tool_name, tool_args, tool_result, error_message, active_skill, timestamp FROM traces WHERE success_score = 0";
    const params = [];
    if (toolName) {
      query += " AND (tool_name = ? OR active_skill = ?)";
      params.push(toolName, toolName);
    }
    query += " ORDER BY timestamp DESC LIMIT 50";
    
    let failures;
    try {
      failures = db.prepare(query).all(...params);
    } catch (dbErr) {
      return `Error reading traces from database: ${dbErr.message}`;
    }

    if (failures.length === 0) {
      return "No recent failures found. No skill improvement is needed at this time.";
    }

    // Group failures by active_skill (fallback to tool_name)
    const grouped = {};
    for (const f of failures) {
      const targetSkill = f.active_skill || f.tool_name;
      if (!grouped[targetSkill]) grouped[targetSkill] = [];
      grouped[targetSkill].push(f);
    }

    const provider = new ProviderRouter(config);
    const report = [];

    for (const [tool, toolFailures] of Object.entries(grouped)) {
      const skillDir = path.resolve(process.cwd(), "src", "skills", tool);
      const skillPath = path.join(skillDir, "SKILL.md");

      // Check if this tool has an associated skill file
      let skillExists = false;
      try {
        await fs.access(skillPath);
        skillExists = true;
      } catch {}

      if (!skillExists) {
        report.push(`Tool/Skill '${tool}' failed ${toolFailures.length} times, but has no SKILL.md file to improve.`);
        continue;
      }

      logger.info(`[Auto-Improvement] Analyzing failures for skill '${tool}'...`);
      let skillContent;
      try {
        skillContent = await fs.readFile(skillPath, "utf8");
      } catch (readErr) {
        report.push(`Failed to read SKILL.md for '${tool}': ${readErr.message}`);
        continue;
      }

      // Format failure cases
      const failureCases = toolFailures
        .map(
          (f, idx) =>
            `Failure #${idx + 1}:\nFailed Tool: ${f.tool_name}\nArgs: ${f.tool_args}\nError: ${f.error_message || f.tool_result}`
        )
        .join("\n\n");

      const prompt = [
        {
          role: "system",
          content: `You are an expert AI system engineer and prompt optimizer.
You will be given the contents of a SKILL.md file that guides an agent's tool execution, along with a list of recent failed executions of that tool.
Your task is to update the SKILL.md file. 
Analyze the failure logs and rewrite the SKILL.md instructions, guidelines, and examples to explicitly prevent these kinds of errors. Add warning sections, better usage examples, and tips for parameters format.

Preserve the frontmatter (delimited by ---) at the top of the file.
Return ONLY the complete, raw content of the updated SKILL.md file. Do not wrap it in markdown code blocks. Do not add any greeting or explanation.`
        },
        {
          role: "user",
          content: `Current SKILL.md for '${tool}':\n\`\`\`markdown\n${skillContent}\n\`\`\`\n\nRecent failures:\n${failureCases}`
        }
      ];

      try {
        const response = await provider.chat(prompt, []);
        let updatedContent = response.content.trim();

        // Strip markdown code block wrapping if the LLM outputted it
        if (updatedContent.startsWith("```markdown")) {
          updatedContent = updatedContent.replace(/^```markdown\n/, "").replace(/\n```$/, "");
        } else if (updatedContent.startsWith("```")) {
          updatedContent = updatedContent.replace(/^```\n/, "").replace(/\n```$/, "");
        }

        // Backup existing skill file
        const backupPath = `${skillPath}.bak`;
        await fs.writeFile(backupPath, skillContent, "utf8");
        logger.info(`[Auto-Improvement] Backed up '${tool}' skill to SKILL.md.bak`);

        // Write updated skill file
        await fs.writeFile(skillPath, updatedContent, "utf8");
        report.push(`Successfully optimized and updated SKILL.md for skill '${tool}' based on ${toolFailures.length} failure traces. Backup saved to SKILL.md.bak`);
      } catch (err) {
        logger.error(`[Auto-Improvement] Failed to optimize skill '${tool}':`, err);
        report.push(`Failed to optimize skill '${tool}': ${err.message}`);
      }
    }

    return report.join("\n\n");
  }
};
