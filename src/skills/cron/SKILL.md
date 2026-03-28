---
name: cron
description: Schedule reminders, recurring tasks, and one-time jobs using the native cron tool.
---

# Cron

Use the native `cron` tool to schedule reminders and recurring tasks. Supports three scheduling modes.

## Actions

- **add** — Create a new scheduled job
- **list** — List all active jobs
- **remove** — Cancel a job by ID

## Scheduling Modes

### 1. Interval (every N seconds)
```
cron(action="add", message="Check server status", every_seconds=3600)
```

### 2. Cron Expression (with optional timezone)
```
cron(action="add", message="Morning standup reminder", cron_expr="0 9 * * 1-5", tz="Europe/Paris")
```

### 3. One-time at specific datetime
```
cron(action="add", message="Call dentist", at="2026-03-21T14:00:00")
```

## Managing Jobs

List all jobs:
```
cron(action="list")
```

Remove a job:
```
cron(action="remove", job_id="job_3")
```

## Time Expressions

| User says          | Tool call                                                   |
| ------------------ | ----------------------------------------------------------- |
| in 5 minutes       | `cron(action="add", message="...", every_seconds=300)`      |
| every day at 9am   | `cron(action="add", message="...", cron_expr="0 9 * * *")`  |
| next Friday at 2pm | `cron(action="add", message="...", at="2026-03-27T14:00")`  |
