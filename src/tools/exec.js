export default {
  schema: {
    name: "exec",
    description: "Execute a shell command and return stdout. IMPORTANT: If restricted to a workspace sandbox, your current directory is the root of your workspace. Do not attempt to use absolute paths outside of it or traverse up.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: { type: "integer", description: "Timeout in ms (default: 30000)" }
      },
      required: ["command"]
    }
  },
  execute: async ({ command, timeout = 30000 }, context) => {
    const { execGuard } = context;
    const check = await execGuard.validate(command);
    if (!check.allowed) return { error: check.reason };
    try {
      const { execSync } = await import("node:child_process");
      const opts = { timeout, encoding: "utf8", maxBuffer: 1024 * 1024, shell: true };
      const wsCwd = execGuard.getWorkspaceCwd();
      if (wsCwd) opts.cwd = wsCwd;
      return execSync(command, opts);
    } catch (err) {
      return { error: err.message, stderr: err.stderr || "", stdout: err.stdout || "" };
    }
  }
};
