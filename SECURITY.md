# Security Policy

## Reporting a Vulnerability

If you discover a vulnerability:

1. **DO NOT** open a public GitHub issue
2. Create a private security advisory on the GitHub repository, or contact the maintainers directly
3. Include: description, steps to reproduce, potential impact, and suggested fix (if any)

## Security Best Practices

### 1. API Key Management

**CRITICAL**: Never commit API keys to version control.

```bash
# ✅ Good: Store in config file with restricted permissions
chmod 600 .jared/config.json

# ❌ Bad: Hardcoding keys in code or committing them
```

**Recommendations:**

- Store API keys in `.jared/config.json` with file permissions `0600`
- Consider using environment variables for sensitive keys (e.g. `BRAVE_API_KEY`)
- Rotate API keys regularly
- Use separate API keys for development and production

### 2. Shell Command Execution (Exec Guard)

Jared includes a built-in security module (`src/agent/exec-guard.js`) that protects the `exec` tool with three layers of defense.

#### Layer 1: Dangerous Pattern Blocklist (always active)

The following patterns are **always blocked**, regardless of mode:

| Pattern                      | Reason                             |
| ---------------------------- | ---------------------------------- |
| `rm -rf`, `rm --force`       | Recursive/forced file deletion     |
| `sudo`, `su -`               | Privilege escalation               |
| `eval`                       | Arbitrary code execution           |
| `mkfs`, `dd if=`             | Disk formatting/overwriting        |
| `curl \| bash`, `wget \| sh` | Pipe-to-shell attacks              |
| `chmod 777`                  | Overly permissive file permissions |
| `shutdown`, `reboot`, `halt` | System power control               |
| `> /etc/`, `> /dev/`         | Writing to system directories      |
| `kill -9 1`                  | Killing init process               |
| `:(){ :\|:& };:`             | Fork bomb                          |
| `history -c`                 | Shell history erasure              |

#### Layer 2: Command Allowlist

Only whitelisted binaries are permitted to run. Every segment in piped commands (`cmd1 | cmd2`) is checked individually.

**Default allowed binaries:**

```
curl, gh, summarize, crontab, echo, cat, grep, head, tail, wc,
date, uname, whoami, pwd, ls, find, jq, sort, uniq, awk, sed, tr,
npx, node, bun, python3, python, git, mkdir, touch, cp
```

Customizable in `.jared/config.json`:

```json
{
  "security": {
    "exec": {
      "allowedBins": ["curl", "gh", "your-custom-binary"]
    }
  }
}
```

#### Layer 3: User Confirmation Mode

When `mode` is set to `"confirm"` (the default), Jared asks for explicit approval before executing:

```
🔒 [EXEC GUARD] Jared wants to run:
   $ curl -s "wttr.in/Paris?format=3"
   Allow? (y/n):
```

#### Configuration

```json
{
  "security": {
    "exec": {
      "mode": "confirm"
    }
  }
}
```

| Mode                | Allowlist | Blocklist | User Prompt |
| ------------------- | :-------: | :-------: | :---------: |
| `confirm` (default) |    ✅     |    ✅     |     ✅      |
| `allowlist`         |    ✅     |    ✅     |     ❌      |
| `unrestricted`      |    ❌     |    ✅     |     ❌      |

> ⚠️ Even in `unrestricted` mode, the dangerous pattern blocklist is **always enforced**.

**Best practices:**

- ✅ Review all tool usage in agent logs
- ✅ Understand what commands the agent is running
- ✅ Use a dedicated user account with limited privileges
- ✅ Never run Jared as root
- ❌ Don't disable security checks
- ❌ Don't run on systems with sensitive data without careful review

### 3. Workspace Sandboxing (`restrictToWorkspace`)

When enabled, Jared's `exec` tool is sandboxed to a dedicated workspace directory. Commands are forced to run inside this directory and cannot escape it.

**What it blocks:**

- Path traversal patterns (`../`)
- Absolute paths outside the workspace (except safe system paths like `/tmp`, `/usr/bin`)
- All commands have their working directory (`cwd`) forced to the workspace

**Configuration:**

```json
{
  "security": {
    "restrictToWorkspace": true,
    "workspaceDir": ".jared/workspace"
  }
}
```

> The workspace directory is created automatically on startup if it doesn't exist. The path is relative to the Jared project root.

**Safe system paths** (always allowed even in restricted mode):

- `/dev/null`, `/tmp`, `/usr/bin`, `/usr/local/bin`, `/bin`

### 4. Memory & SQLite

Jared utilizes local SQLite instances for memory. 100% of memory injection, deduplication, and search happen entirely on your filesystem — your conversational context is isolated from external cloud databases.

- Ensure proper file permissions (`chmod 600`) on the directory containing `memory.db`
- Chat history is stored locally — protect the `.jared/` directory

### 5. Network Security

**API Calls:**

- All external API calls use HTTPS by default
- Command execution has a 30-second timeout by default
- `web_fetch` validates URLs (http/https only) and follows redirects safely

### 6. Dependency Audit

Regularly check for vulnerable dependencies:

```bash
bun run audit
# or directly:
npm audit --audit-level=moderate
```

If vulnerabilities are found:

```bash
npm audit fix
```

### 7. Data Privacy

- **Logs may contain sensitive information** — secure log files appropriately
- **LLM providers see your prompts** — review their privacy policies
- **Chat history is stored locally** — protect the `.jared/` directory
- **API keys are in plain text** in `config.json` — use file permissions to protect

### 8. Resource Protection

| Protection            | Value                          |
| --------------------- | ------------------------------ |
| Shell command timeout | 30s (configurable per call)    |
| Shell output buffer   | 1MB max                        |
| Web fetch timeout     | Default browser timeout        |
| Web fetch max chars   | 50,000 (configurable per call) |

## Security Features Summary

✅ **Exec Guard** — Three-layer shell command security (blocklist + allowlist + confirmation)
✅ **Workspace Sandboxing** — Restrict all exec commands to a dedicated workspace directory
✅ **Input Validation** — Dangerous command pattern detection, URL validation, path traversal protection
✅ **Resource Limits** — Command timeouts, output truncation, fetch character limits
✅ **Secure Communication** — HTTPS for all external API calls
✅ **Local-first Privacy** — Memory stored in local SQLite, no cloud dependency
✅ **Dependency Audit** — Built-in `bun run audit` command for vulnerability scanning

## Known Limitations

⚠️ **Current Limitations:**

1. **No `allowFrom` per channel** — No user whitelist filtering on chat channels yet
2. **No Rate Limiting** — Users can send unlimited messages
3. **Plain Text Config** — API keys stored in plain text
4. **No Session Expiry** — No automatic session timeout
5. **No Audit Trail** — Limited security event logging

## Security Checklist

Before deploying Jared:

- [ ] API keys stored securely (not in code)
- [ ] Config file permissions set to `chmod 600 .jared/config.json`
- [ ] Memory database permissions set to `chmod 600 .jared/memory.db`
- [ ] Running as non-root user
- [ ] Exec guard mode set appropriately (`confirm` or `allowlist`)
- [ ] Allowed binaries list reviewed and customized
- [ ] Workspace sandboxing enabled if needed (`restrictToWorkspace: true`)
- [ ] Dependencies audited (`bun run audit`)
- [ ] Logs monitored for security events
- [ ] Rate limits configured on API providers
- [ ] Security review of custom skills
