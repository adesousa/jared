export default {
  schema: {
    name: "exec",
    description: "Execute a command and return stdout. IMPORTANT: Shell features like pipes (|) and redirects (>) are not supported for security reasons. If restricted to a workspace sandbox, your current directory is the root of your workspace. Do not attempt to use absolute paths outside of it or traverse up.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to execute (e.g. 'ls -la /tmp')" },
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
      const { execFileSync } = await import("node:child_process");
      const opts = { timeout, encoding: "utf8", maxBuffer: 1024 * 1024 };
      const wsCwd = execGuard.getWorkspaceCwd();
      if (wsCwd) opts.cwd = wsCwd;

      const argsMatch = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
      if (!argsMatch) return { error: "Empty command" };

      const args = argsMatch.map(s => s.replace(/^["']|["']$/g, ''));
      const bin = args.shift();
      return execFileSync(bin, args, opts);
    } catch (err) {
      return { error: err.message, stderr: err.stderr || "", stdout: err.stdout || "" };
    }
  }
};
