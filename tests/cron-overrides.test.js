import test from "node:test";
import assert from "node:assert";

// Function under test
function parseTaskOverrides(tasks, providersKeys) {
  let providerOverride = null;
  let noContext = false;
  
  const cleanedTasks = tasks.map(task => {
    let cleaned = task;
    const match = cleaned.match(/--([a-zA-Z0-9_-]+)(?:\s|$)/);
    if (match && providersKeys.includes(match[1])) {
      providerOverride = match[1];
      cleaned = cleaned.replace(match[0], " ").trim();
    }
    if (cleaned.includes("--nocontext")) {
      noContext = true;
      cleaned = cleaned.replace(/--nocontext/g, "").replace(/\s+/g, " ").trim();
    }
    return cleaned;
  });

  return { cleanedTasks, providerOverride, noContext };
}

test("parseTaskOverrides: extracts provider override and cleans task string", () => {
  const tasks = ["fetch prices --openai"];
  const providersKeys = ["openai", "gemini", "ollama"];
  const res = parseTaskOverrides(tasks, providersKeys);

  assert.strictEqual(res.providerOverride, "openai");
  assert.strictEqual(res.noContext, false);
  assert.deepStrictEqual(res.cleanedTasks, ["fetch prices"]);
});

test("parseTaskOverrides: extracts noContext override and cleans task string", () => {
  const tasks = ["fetch prices --nocontext"];
  const providersKeys = ["openai", "gemini", "ollama"];
  const res = parseTaskOverrides(tasks, providersKeys);

  assert.strictEqual(res.providerOverride, null);
  assert.strictEqual(res.noContext, true);
  assert.deepStrictEqual(res.cleanedTasks, ["fetch prices"]);
});

test("parseTaskOverrides: extracts both overrides and cleans task string", () => {
  const tasks = ["fetch prices --openai --nocontext"];
  const providersKeys = ["openai", "gemini", "ollama"];
  const res = parseTaskOverrides(tasks, providersKeys);

  assert.strictEqual(res.providerOverride, "openai");
  assert.strictEqual(res.noContext, true);
  assert.deepStrictEqual(res.cleanedTasks, ["fetch prices"]);
});

test("parseTaskOverrides: ignores invalid provider override", () => {
  const tasks = ["fetch prices --unknown"];
  const providersKeys = ["openai", "gemini", "ollama"];
  const res = parseTaskOverrides(tasks, providersKeys);

  assert.strictEqual(res.providerOverride, null);
  assert.strictEqual(res.noContext, false);
  assert.deepStrictEqual(res.cleanedTasks, ["fetch prices --unknown"]);
});
