import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import execTool from "../src/tools/exec.js";

function setupWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jared-exec-test-"));
  const mockExecGuard = {
    validate: async () => ({ allowed: true }),
    getWorkspaceCwd: () => dir
  };
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {}
  };
  return { dir, context: { execGuard: mockExecGuard }, cleanup };
}

test("execTool executes simple echo command", async () => {
  const { context, cleanup } = setupWorkspace();
  try {
    const result = await execTool.execute({ command: "echo 'Hello World'" }, context);
    assert.strictEqual(result.trim(), "Hello World");
  } finally {
    cleanup();
  }
});

test("execTool supports output redirection to a file", async () => {
  const { dir, context, cleanup } = setupWorkspace();
  try {
    const filePath = path.join(dir, "todo.txt");
    const result = await execTool.execute({ command: `echo "Hello, Founder!" > "${filePath}"` }, context);
    
    // Check that file exists and contains the correct content
    assert.ok(fs.existsSync(filePath), "todo.txt should be created");
    const content = fs.readFileSync(filePath, "utf8");
    assert.strictEqual(content.trim(), "Hello, Founder!");
  } finally {
    cleanup();
  }
});

test("execTool supports append redirection to a file", async () => {
  const { dir, context, cleanup } = setupWorkspace();
  try {
    const filePath = path.join(dir, "todo.txt");
    fs.writeFileSync(filePath, "Line 1\n", "utf8");
    await execTool.execute({ command: `echo "Line 2" >> "${filePath}"` }, context);
    
    const content = fs.readFileSync(filePath, "utf8");
    assert.strictEqual(content.trim(), "Line 1\nLine 2");
  } finally {
    cleanup();
  }
});

test("execTool supports piping commands", async () => {
  const { context, cleanup } = setupWorkspace();
  try {
    const result = await execTool.execute({ command: "echo -e 'apple\nbanana\ncherry' | grep banana" }, context);
    assert.strictEqual(result.trim(), "banana");
  } finally {
    cleanup();
  }
});

test("execTool returns error message when command fails", async () => {
  const { context, cleanup } = setupWorkspace();
  try {
    const result = await execTool.execute({ command: "nonexistentcommand" }, context);
    assert.ok(result.error);
    assert.ok(result.stderr);
  } finally {
    cleanup();
  }
});
