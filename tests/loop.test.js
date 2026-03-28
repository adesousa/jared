import test from "node:test";
import assert from "node:assert";
import AgentLoop from "../src/agent/loop.js";

test("AgentLoop should correctly instantiate and store dependencies", () => {
  const context = { id: "context" };
  const memory = { id: "memory" };
  const skills = { id: "skills" };
  const mcp = { id: "mcp" };
  const provider = { id: "provider" };

  const loop = new AgentLoop(context, memory, skills, mcp, provider);

  assert.strictEqual(loop.context, context);
  assert.strictEqual(loop.memory, memory);
  assert.strictEqual(loop.skills, skills);
  assert.strictEqual(loop.mcp, mcp);
  assert.strictEqual(loop.provider, provider);
  assert.strictEqual(loop.isRunning, false);
});
