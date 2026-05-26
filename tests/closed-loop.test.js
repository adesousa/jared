import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import MemoryManager from "../src/agent/memory.js";
import AgentLoop from "../src/agent/loop.js";

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jared-closed-loop-"));
  return { dbPath: path.join(dir, "memory.db"), cleanup: () => fs.rmSync(dir, { recursive: true }) };
}

test("Closed-Loop Traces: addTrace and getRecentFailures", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  // Add successful trace
  await mm.addTrace("s1", "build app", "compile", '{"flags": "-o"}', "success compile", 1, null);

  // Add failed trace
  await mm.addTrace("s1", "build app", "compile", '{"flags": "-err"}', "gcc error", 0, "gcc error details");

  // Verify recent failures are retrieved
  const failures = await mm.getRecentFailures("compile", 5);
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(failures[0].error_message, "gcc error details");

  cleanup();
});

test("Closed-Loop Compaction: getFullSessionMessages and truncateSessionMessages", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addMessage("s1", "user", "Message 1");
  await mm.addMessage("s1", "assistant", "Message 2");
  await mm.addMessage("s1", "user", "Message 3");
  await mm.addMessage("s1", "assistant", "Message 4");

  const initialMsgs = await mm.getFullSessionMessages("s1");
  assert.strictEqual(initialMsgs.length, 4);

  // Truncate keeping only the last 2 messages (IDs of Message 3 and Message 4)
  const keepIds = initialMsgs.slice(2).map(m => m.id);
  await mm.truncateSessionMessages("s1", keepIds);

  const finalMsgs = await mm.getFullSessionMessages("s1");
  assert.strictEqual(finalMsgs.length, 2);
  assert.strictEqual(finalMsgs[0].content, "Message 3");
  assert.strictEqual(finalMsgs[1].content, "Message 4");

  cleanup();
});

test("AgentLoop: In-Session Compaction Trigger and Execution", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  // Set up 10 historical messages
  for (let i = 0; i < 10; i++) {
    await mm.addMessage("s1", "user", "Some dummy prompt ".repeat(100)); // Large enough to exceed threshold easily
  }

  const mockContext = {
    buildPrompt: async () => [
      { role: "system", content: "System instructions" },
      { role: "user", content: "Active task" }
    ]
  };

  const mockSkills = { getTools: () => [] };
  const mockMcp = { getTools: () => [] };
  let chatCalled = 0;
  const mockProvider = {
    chat: async (messages) => {
      chatCalled++;
      // Check if it's the compaction prompt
      if (messages[0].content.includes("internal system memory compaction")) {
        return {
          content: "[FACT] User prefers clean code\n[SUMMARY] Exceeded context limits and summarized",
          message: { role: "assistant", content: "" }
        };
      }
      // Otherwise final task result
      return {
        content: "Completed successfully",
        message: { role: "assistant", content: "Completed successfully" }
      };
    }
  };

  // Run loop with very low compaction threshold (100 tokens ~ 400 chars)
  const config = {
    agents: {
      defaults: {
        compactionThreshold: 100,
        compactionKeepCount: 2,
        selfReview: false // Disable self review for this test
      }
    }
  };

  const loop = new AgentLoop(mockContext, mm, mockSkills, mockMcp, mockProvider, 1, 5, config);
  const result = await loop.runTask("test task", "s1", "u1");

  assert.strictEqual(result.content, "Completed successfully");
  
  // Verify that memory now has the compaction results
  const facts = await mm.getCoreMemories("u1");
  assert.ok(facts.includes("User prefers clean code"));
  assert.ok(facts.includes("Exceeded context limits and summarized"));

  // Check that the history was truncated to 2 messages (plus any new messages added during loop)
  const finalMsgs = await mm.getFullSessionMessages("s1");
  // The compaction leaves compactionKeepCount (2) messages.
  assert.ok(finalMsgs.length <= 4);

  cleanup();
});

test("AgentLoop: Critic Self-Review Cycle", async () => {
  const mockContext = {
    buildPrompt: async () => [
      { role: "system", content: "System instructions" }
    ]
  };

  const mockSkills = { getTools: () => [] };
  const mockMcp = { getTools: () => [] };
  let chatCount = 0;

  const mockProvider = {
    chat: async (messages) => {
      chatCount++;
      if (messages[0].role === "system" && messages[0].content.includes("quality assurance critic")) {
        if (chatCount === 2) {
          // Reject first attempt
          return { content: "FAIL: Missing error boundary tests." };
        }
        // Accept second attempt
        return { content: "PASS" };
      }

      // Normal execution response
      if (chatCount === 1) {
        return {
          content: "Here is code without error boundaries",
          message: { role: "assistant", content: "Here is code without error boundaries" }
        };
      }
      return {
        content: "Here is corrected code with error boundaries",
        message: { role: "assistant", content: "Here is corrected code with error boundaries" }
      };
    }
  };

  const config = {
    agents: {
      defaults: {
        selfReview: true
      }
    }
  };

  const loop = new AgentLoop(mockContext, null, mockSkills, mockMcp, mockProvider, 5, 5, config);
  const result = await loop.runTask("Write robust code", "s1", "u1");

  // The loop should have run, initiated review, failed, retried, reviewed again, passed, and returned the second answer.
  assert.strictEqual(result.content, "Here is corrected code with error boundaries");
  assert.strictEqual(chatCount, 4); // 2 normal runs + 2 reviews
});

test("Closed-Loop: auto-improve gets active_skill traces", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  // Insert a trace with active_skill = 'weather'
  await mm.addTrace("s1", "check weather tomorrow", "exec", '{"cmd": "curl weather"}', "curl timeout", 0, "timeout error", "weather");

  const rows = mm.db.prepare("SELECT active_skill FROM traces WHERE tool_name = ?").all("exec");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].active_skill, "weather");

  cleanup();
});

test("AgentLoop: Critic Scored Self-Review Cycle (Score < 7 fails, >= 7 passes)", async () => {
  const mockContext = {
    buildPrompt: async () => [
      { role: "system", content: "System instructions" }
    ]
  };

  const mockSkills = { getTools: () => [] };
  const mockMcp = { getTools: () => [] };
  let chatCount = 0;

  const mockProvider = {
    chat: async (messages) => {
      chatCount++;
      if (messages[0].role === "system" && messages[0].content.includes("quality assurance critic")) {
        if (chatCount === 2) {
          // Reject first attempt (score 5 < 7)
          return { content: "SCORE: 5\nREASON: Code is missing tests." };
        }
        // Accept second attempt (score 8 >= 7)
        return { content: "SCORE: 8\nREASON: Code is good." };
      }

      // Normal execution response
      if (chatCount === 1) {
        return {
          content: "Here is code without tests",
          message: { role: "assistant", content: "Here is code without tests" }
        };
      }
      return {
        content: "Here is code with tests",
        message: { role: "assistant", content: "Here is code with tests" }
      };
    }
  };

  const config = {
    agents: {
      defaults: {
        selfReview: true
      }
    }
  };

  const loop = new AgentLoop(mockContext, null, mockSkills, mockMcp, mockProvider, 5, 5, config);
  const result = await loop.runTask("Write code with tests", "s1", "u1");

  assert.strictEqual(result.content, "Here is code with tests");
  assert.strictEqual(chatCount, 4); // 2 normal runs + 2 reviews
  assert.strictEqual(result.attempt, 2);
});
