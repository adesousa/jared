import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import ConfigManager from "../src/config/index.js";

const PROJECT_NAME = "test-config-manager";
const CONFIG_DIR = path.join(process.cwd(), ".jared", PROJECT_NAME);
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

async function cleanup() {
  try {
    await fs.rm(CONFIG_DIR, { recursive: true, force: true });
  } catch (err) {
    // Ignore
  }
}

test("ConfigManager constructor throws if projectName is missing", () => {
  assert.throws(() => new ConfigManager(), /ConfigManager requires a projectName/);
});

test("ConfigManager load() initializes with defaults when file is missing", async () => {
  await cleanup();
  const cm = new ConfigManager(PROJECT_NAME);
  const config = await cm.load();

  assert.strictEqual(config.projectName, PROJECT_NAME);
  assert.strictEqual(config.channels.console.enabled, true);

  // Verify file was saved
  const fileContent = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  assert.strictEqual(fileContent.channels.console.enabled, true);

  await cleanup();
});

test("ConfigManager load() reads existing config file", async () => {
  await cleanup();
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const customConfig = { channels: { console: { enabled: false } } };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(customConfig), "utf8");

  const cm = new ConfigManager(PROJECT_NAME);
  const config = await cm.load();

  assert.strictEqual(config.channels.console.enabled, false);
  assert.strictEqual(config.projectName, PROJECT_NAME);

  await cleanup();
});

test("ConfigManager get() retrieves values with dot notation", async () => {
  const cm = new ConfigManager(PROJECT_NAME);
  cm.config = { a: { b: { c: 123 } } };

  assert.strictEqual(cm.get("a.b.c"), 123);
  assert.strictEqual(cm.get("a.b.x"), undefined);
  assert.strictEqual(cm.get("nonexistent"), undefined);
});

test("ConfigManager refresh() merges defaults with current config", async () => {
  await cleanup();
  const cm = new ConfigManager(PROJECT_NAME);
  await cm.load();

  // Modify config
  cm.config.channels.console.enabled = false;
  // Delete a key that should be in defaults
  delete cm.config.providers.ollama;

  await cm.refresh();

  // Existing value should be preserved
  assert.strictEqual(cm.config.channels.console.enabled, false);
  // Missing key from defaults should be restored
  assert.ok(cm.config.providers.ollama);
  assert.strictEqual(cm.config.providers.ollama.url, "http://localhost:11434");

  await cleanup();
});

test("ConfigManager reset() resets to defaults", async () => {
  await cleanup();
  const cm = new ConfigManager(PROJECT_NAME);
  await cm.load();

  cm.config.channels.console.enabled = false;
  await cm.reset();

  assert.strictEqual(cm.config.channels.console.enabled, true);

  const fileContent = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  assert.strictEqual(fileContent.channels.console.enabled, true);

  await cleanup();
});
