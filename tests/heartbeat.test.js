import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import HeartbeatManager from "../src/heartbeat/index.js";

function tmpHeartbeatFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jared-hb-"));
  const file = path.join(dir, "HEARTBEAT.md");
  fs.writeFileSync(file, content, "utf8");
  return { file, cleanup: () => fs.rmSync(dir, { recursive: true }) };
}

test("HeartbeatManager parses active tasks from HEARTBEAT.md", () => {
  const { file, cleanup } = tmpHeartbeatFile(`# Heartbeat Tasks

## Active Tasks

- Check server status
- Remind me to drink water

## Completed

- Old task
`);
  const hb = new HeartbeatManager(file);
  const tasks = hb._readTasks();
  assert.deepStrictEqual(tasks, ["Check server status", "Remind me to drink water"]);
  cleanup();
});

test("HeartbeatManager returns empty array when no active tasks", () => {
  const { file, cleanup } = tmpHeartbeatFile(`# Heartbeat Tasks

## Active Tasks

<!-- nothing here -->

## Completed
`);
  const hb = new HeartbeatManager(file);
  assert.deepStrictEqual(hb._readTasks(), []);
  cleanup();
});

test("HeartbeatManager returns empty array when file does not exist", () => {
  const hb = new HeartbeatManager("/tmp/nonexistent_heartbeat_file.md");
  assert.deepStrictEqual(hb._readTasks(), []);
});

test("HeartbeatManager returns empty array for empty file", () => {
  const { file, cleanup } = tmpHeartbeatFile("");
  const hb = new HeartbeatManager(file);
  assert.deepStrictEqual(hb._readTasks(), []);
  cleanup();
});

test("HeartbeatManager ignores non-task lines under Active Tasks", () => {
  const { file, cleanup } = tmpHeartbeatFile(`## Active Tasks

Some freeform text here
- Actual task
Not a task either
  - Indented (not a top-level task)
- Another real task
`);
  const hb = new HeartbeatManager(file);
  assert.deepStrictEqual(hb._readTasks(), ["Actual task", "Another real task"]);
  cleanup();
});

test("HeartbeatManager start is idempotent", () => {
  const hb = new HeartbeatManager("/tmp/nonexistent.md", 999999);
  hb.start();
  const firstTimer = hb.timer;
  hb.start();
  assert.strictEqual(hb.timer, firstTimer);
  hb.stop();
});

test("HeartbeatManager stop clears timer", () => {
  const hb = new HeartbeatManager("/tmp/nonexistent.md", 999999);
  hb.start();
  assert.notStrictEqual(hb.timer, null);
  hb.stop();
  assert.strictEqual(hb.timer, null);
});
