import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import ContextManager from "../src/agent/context.js";
import MemoryManager from "../src/agent/memory.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jared-ctx-"));
}

test("ContextManager loads soul from file", async () => {
  const dir = tmpDir();
  const soulPath = path.join(dir, "SOUL.md");
  fs.writeFileSync(soulPath, "I am TestBot, a test agent.", "utf8");

  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();

  const ctx = new ContextManager(memory, soulPath);
  const soul = await ctx.loadSoul();
  assert.ok(soul.includes("TestBot"));

  fs.rmSync(dir, { recursive: true });
});

test("ContextManager falls back when soul file is missing", async () => {
  const dir = tmpDir();
  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();

  const ctx = new ContextManager(memory, path.join(dir, "nonexistent.md"));
  const soul = await ctx.loadSoul();
  assert.ok(soul.includes("Jared"));

  fs.rmSync(dir, { recursive: true });
});

test("ContextManager caches soul after first load", async () => {
  const dir = tmpDir();
  const soulPath = path.join(dir, "SOUL.md");
  fs.writeFileSync(soulPath, "Original soul", "utf8");

  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();

  const ctx = new ContextManager(memory, soulPath);
  const first = await ctx.loadSoul();
  // Modify file after first load
  fs.writeFileSync(soulPath, "Modified soul", "utf8");
  const second = await ctx.loadSoul();
  assert.strictEqual(first, second); // Should return cached version

  fs.rmSync(dir, { recursive: true });
});

test("ContextManager buildPrompt includes soul and core facts", async () => {
  const dir = tmpDir();
  const soulPath = path.join(dir, "SOUL.md");
  fs.writeFileSync(soulPath, "I am Jared, the test COO.", "utf8");

  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();
  await memory.addCoreMemory("user1", "User speaks French");
  await memory.addCoreMemory("user1", "User is a developer");

  const ctx = new ContextManager(memory, soulPath);
  const messages = await ctx.buildPrompt("Hello", "session1", "user1");

  // System prompt should include soul
  const systemMsg = messages.find(m => m.role === "system");
  assert.ok(systemMsg);
  assert.ok(systemMsg.content.includes("Jared"));
  assert.ok(systemMsg.content.includes("User speaks French"));
  assert.ok(systemMsg.content.includes("User is a developer"));

  // Last message should be the user request
  const lastMsg = messages[messages.length - 1];
  assert.strictEqual(lastMsg.role, "user");
  assert.strictEqual(lastMsg.content, "Hello");

  fs.rmSync(dir, { recursive: true });
});

test("ContextManager buildPrompt includes history", async () => {
  const dir = tmpDir();
  const soulPath = path.join(dir, "SOUL.md");
  fs.writeFileSync(soulPath, "Test soul", "utf8");

  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();
  await memory.addMessage("session1", "user", "Previous question");
  await memory.addMessage("session1", "assistant", "Previous answer");

  const ctx = new ContextManager(memory, soulPath);
  const messages = await ctx.buildPrompt("New question", "session1", "user1");

  // Should contain history messages between system and user
  assert.ok(messages.length >= 3); // system + history + user
  const roles = messages.map(m => m.role);
  assert.strictEqual(roles[0], "system");
  assert.strictEqual(roles[roles.length - 1], "user");

  fs.rmSync(dir, { recursive: true });
});

test("ContextManager buildPrompt with no facts shows placeholder", async () => {
  const dir = tmpDir();
  const soulPath = path.join(dir, "SOUL.md");
  fs.writeFileSync(soulPath, "Test soul", "utf8");

  const dbPath = path.join(dir, "memory.db");
  const memory = new MemoryManager(dbPath);
  await memory.initialize();

  const ctx = new ContextManager(memory, soulPath);
  const messages = await ctx.buildPrompt("Hi", "session1", "user1");
  const systemMsg = messages.find(m => m.role === "system");
  assert.ok(systemMsg.content.includes("No core memory"));

  fs.rmSync(dir, { recursive: true });
});
