import test from "node:test";
import assert from "node:assert";
import spawnTool from "../src/tools/spawn.js";

test("spawn tool runs subagent and emits message:send with usage and attempt on success", async () => {
  const mockAgentManager = {
    spinUp: async (task, opts) => {
      assert.strictEqual(task, "Test background task");
      assert.strictEqual(opts.isSubagent, true);
      assert.strictEqual(opts.role, "scrum_master");
      await new Promise(resolve => setTimeout(resolve, 5));
      return {
        content: "Retro plan generated",
        usage: { promptTokens: 123, completionTokens: 456 },
        attempt: 2
      };
    }
  };

  const emittedEvents = [];
  const mockBus = {
    emit: (eventName, payload) => {
      emittedEvents.push({ eventName, payload });
    }
  };

  const addedMessages = [];
  const mockMemory = {
    addMessage: async (sessionId, role, content) => {
      addedMessages.push({ sessionId, role, content });
    }
  };

  const resultMessage = await spawnTool.execute(
    { task: "Test background task", label: "Retro", role: "scrum_master" },
    {
      agentManager: mockAgentManager,
      modelOverride: null,
      channel: "console",
      userId: "local_user",
      sessionId: "session-123",
      bus: mockBus,
      isSubagent: false,
      memory: mockMemory
    }
  );

  assert.ok(resultMessage.includes("Spawned background task: \"Retro\""));

  // Check sync event
  assert.strictEqual(emittedEvents.length, 1);
  assert.strictEqual(emittedEvents[0].eventName, "subagent:start");

  // Wait for the asynchronous spinUp to finish and trigger promise callbacks
  await new Promise(resolve => setTimeout(resolve, 10));

  // We expect:
  // 1. subagent:start (sync)
  // 2. subagent:end (async)
  // 3. message:send (async)
  assert.strictEqual(emittedEvents.length, 3);
  
  assert.strictEqual(emittedEvents[1].eventName, "subagent:end");
  assert.deepStrictEqual(emittedEvents[1].payload, {
    channel: "console",
    sessionId: "session-123"
  });

  assert.strictEqual(emittedEvents[2].eventName, "message:send");
  const msgPayload = emittedEvents[2].payload;
  assert.strictEqual(msgPayload.channel, "console");
  assert.strictEqual(msgPayload.userId, "local_user");
  assert.strictEqual(msgPayload.sessionId, "session-123");
  assert.ok(msgPayload.content.includes("Background task \"Retro\" completed by `Scrum Master`"));
  assert.ok(msgPayload.content.includes("Retro plan generated"));
  assert.deepStrictEqual(msgPayload.usage, { promptTokens: 123, completionTokens: 456 });
  assert.strictEqual(msgPayload.attempt, 2);

  // Assert that memory message was saved
  assert.strictEqual(addedMessages.length, 1);
  assert.strictEqual(addedMessages[0].sessionId, "session-123");
  assert.strictEqual(addedMessages[0].role, "assistant");
  assert.ok(addedMessages[0].content.includes("Background task \"Retro\" completed by `Scrum Master`"));
  assert.ok(addedMessages[0].content.includes("Retro plan generated"));
});

test("spawn tool throws error if executed by a subagent", async () => {
  await assert.rejects(
    async () => {
      await spawnTool.execute(
        { task: "Nested task" },
        { isSubagent: true }
      );
    },
    /Subagents cannot spawn other subagents/
  );
});
