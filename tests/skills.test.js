import test from "node:test";
import assert from "node:assert";
import path from "node:path";
import SkillsManager from "../src/agent/skills.js";

test("SkillsManager loadToolsFromDirectory filters spawn, cron, auto_improve for subagents", async () => {
  const skills = new SkillsManager();
  const toolsDir = path.resolve(process.cwd(), "src", "tools");
  
  // Normal/main agent context
  await skills.loadToolsFromDirectory(toolsDir, { isSubagent: false }, true);
  const normalToolNames = skills.getTools().map(t => t.function.name);
  assert.ok(normalToolNames.includes("spawn"));
  assert.ok(normalToolNames.includes("cron"));
  assert.ok(normalToolNames.includes("auto_improve"));

  // Subagent context
  const subagentSkills = new SkillsManager();
  await subagentSkills.loadToolsFromDirectory(toolsDir, { isSubagent: true }, true);
  const subagentToolNames = subagentSkills.getTools().map(t => t.function.name);
  assert.ok(!subagentToolNames.includes("spawn"));
  assert.ok(!subagentToolNames.includes("cron"));
  assert.ok(!subagentToolNames.includes("auto_improve"));
});
