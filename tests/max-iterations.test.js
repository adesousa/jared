import test from "node:test";
import assert from "node:assert";
import AgentLoop from "../src/agent/loop.js";

test("AgentLoop should respect maxIterations from constructor", async () => {
  const context = {
    buildPrompt: async () => [{ role: "system", content: "test" }]
  };
  const memory = {};
  const skills = { getTools: () => [] };
  const mcp = { getTools: () => [] };
  
  let iterations = 0;
  const provider = {
    chat: async () => {
      iterations++;
      return {
        message: { role: "assistant", tool_calls: [{ id: "1", function: { name: "test", arguments: "{}" } }] },
        tool_calls: [{ id: "1", function: { name: "test", arguments: "{}" } }]
      };
    }
  };

  // Mock skills.executeTool
  skills.executeTool = async () => ({ result: "ok" });
  mcp.hasTool = () => false;

  const maxIterations = 3;
  const loop = new AgentLoop(context, memory, skills, mcp, provider, maxIterations);

  try {
    await loop.runTask("test task", "session-1", "user-1");
    assert.fail("Should have thrown 'Max iterations reached' error");
  } catch (err) {
    assert.strictEqual(err.message, "Max iterations reached without completion.");
    assert.strictEqual(iterations, maxIterations);
  }
});
