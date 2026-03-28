import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import MemoryManager from "../src/agent/memory.js";

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jared-mem-"));
  return { dbPath: path.join(dir, "memory.db"), cleanup: () => fs.rmSync(dir, { recursive: true }) };
}

test("MemoryManager initializes tables without error", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();
  assert.ok(fs.existsSync(dbPath));
  cleanup();
});

test("MemoryManager addMessage and getRecentContext", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addMessage("s1", "user", "Hello");
  await mm.addMessage("s1", "assistant", "Hi there!");
  await mm.addMessage("s1", "user", "How are you?");

  const context = await mm.getRecentContext("s1");
  assert.strictEqual(context.length, 3);
  assert.strictEqual(context[0].role, "user");
  assert.strictEqual(context[0].content, "Hello");
  assert.strictEqual(context[2].content, "How are you?");
  cleanup();
});

test("MemoryManager getRecentContext respects limit", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  for (let i = 0; i < 20; i++) {
    await mm.addMessage("s1", "user", `msg-${i}`);
  }

  const context = await mm.getRecentContext("s1", 5);
  assert.strictEqual(context.length, 5);
  // Should be the 5 most recent, in chronological order
  assert.strictEqual(context[0].content, "msg-15");
  assert.strictEqual(context[4].content, "msg-19");
  cleanup();
});

test("MemoryManager getRecentContext isolates sessions", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addMessage("s1", "user", "Session 1 message");
  await mm.addMessage("s2", "user", "Session 2 message");

  const ctx1 = await mm.getRecentContext("s1");
  const ctx2 = await mm.getRecentContext("s2");
  assert.strictEqual(ctx1.length, 1);
  assert.strictEqual(ctx2.length, 1);
  assert.strictEqual(ctx1[0].content, "Session 1 message");
  assert.strictEqual(ctx2[0].content, "Session 2 message");
  cleanup();
});

// === Core Memories ===

test("MemoryManager addCoreMemory and getCoreMemories", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addCoreMemory("user1", "Speaks French");
  await mm.addCoreMemory("user1", "Lives in Paris");
  const facts = await mm.getCoreMemories("user1");

  assert.match(facts, /### Facts/);
  assert.ok(facts.includes("Speaks French"));
  assert.ok(facts.includes("Lives in Paris"));
  cleanup();
});

test("MemoryManager categorizes core memories correctly", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addCoreMemory("user1", "Loves JavaScript", "fact");
  await mm.addCoreMemory("user1", "Prefers dark mode", "preference");
  await mm.addCoreMemory("user1", "Always write tests", "rule");
  await mm.addCoreMemory("user1", "Talked about cats", "summary");

  const memories = await mm.getCoreMemories("user1");

  assert.match(memories, /### Facts/);
  assert.ok(memories.includes("Loves JavaScript"));

  assert.match(memories, /### Preferences/);
  assert.ok(memories.includes("Prefers dark mode"));

  assert.match(memories, /### Rules/);
  assert.ok(memories.includes("Always write tests"));

  assert.match(memories, /### Summaries/);
  assert.ok(memories.includes("Talked about cats"));

  cleanup();
});

test("MemoryManager getCoreMemories isolates users", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addCoreMemory("user1", "Fact for user1");
  await mm.addCoreMemory("user2", "Fact for user2");

  const facts1 = await mm.getCoreMemories("user1");
  const facts2 = await mm.getCoreMemories("user2");
  assert.ok(facts1.includes("Fact for user1"));
  assert.ok(!facts1.includes("Fact for user2"));
  assert.ok(facts2.includes("Fact for user2"));
  cleanup();
});

test("MemoryManager removeCoreMemory by id", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addCoreMemory("user1", "Temp fact");
  const facts = await mm.getCoreMemories("user1");
  // Extract ID from "[ID: X] Temp fact"
  const match = facts.match(/\[ID: (\d+)\]/);
  assert.ok(match, "Should have an ID in output");
  const id = parseInt(match[1]);

  await mm.removeCoreMemory("user1", id);
  const afterRemoval = await mm.getCoreMemories("user1");
  assert.ok(!afterRemoval.includes("Temp fact"));
  cleanup();
});

test("MemoryManager getCoreMemories returns empty string when no facts", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  const facts = await mm.getCoreMemories("no_user");
  assert.strictEqual(facts, "");
  cleanup();
});

// === Search ===

test("MemoryManager searchPastEvents finds matching messages", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addMessage("s1", "user", "I love JavaScript");
  await mm.addMessage("s1", "assistant", "JavaScript is great!");
  await mm.addMessage("s1", "user", "What about Python?");

  const results = await mm.searchPastEvents("JavaScript");
  assert.ok(results.includes("JavaScript"));
  assert.ok(!results.includes("Python"));
  cleanup();
});

test("MemoryManager searchPastEvents returns empty when no match", async () => {
  const { dbPath, cleanup } = tmpDb();
  const mm = new MemoryManager(dbPath);
  await mm.initialize();

  await mm.addMessage("s1", "user", "Hello world");
  const results = await mm.searchPastEvents("nonexistent_term_xyz");
  assert.strictEqual(results, "");
  cleanup();
});
