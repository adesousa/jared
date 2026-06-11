export default {
  schema: {
    name: "run_terminal_command",
    description:
      "Execute a terminal / bash shell command (e.g. 'curl', 'git', 'mkdir', 'ls', 'grep') and return stdout. IMPORTANT: If restricted to a workspace sandbox, your current directory is the root of your workspace. Do not attempt to use absolute paths outside of it or traverse up. You can still attempt urls starting by http or https",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute (e.g. 'ls -la /tmp')"
        },
        timeout: {
          type: "integer",
          description: "Timeout in ms (default: 120000)"
        }
      },
      required: ["command"]
    }
  },
  execute: async ({ command, timeout = 120000 }, context) => {
    const { execGuard } = context;
    const check = await execGuard.validate(command);
    if (!check.allowed) return { error: check.reason };
    try {
      const { exec } = await import("node:child_process");
      const opts = { timeout, encoding: "utf8", maxBuffer: 1024 * 1024 };
      const wsCwd = execGuard.getWorkspaceCwd();
      if (wsCwd) opts.cwd = wsCwd;

      if (!command || !command.trim()) return { error: "Empty command" };

      return await new Promise((resolve) => {
        exec(command, opts, (error, stdout, stderr) => {
          if (error) {
            resolve({
              error: error.message,
              stderr: stderr || "",
              stdout: stdout || ""
            });
          } else {
            resolve(stdout);
          }
        });
      });
    } catch (err) {
      return {
        error: err.message,
        stderr: err.stderr || "",
        stdout: err.stdout || ""
      };
    }
  }
};
