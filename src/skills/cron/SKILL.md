---
name: cron
description: Schedule reminders, recurring tasks, and one-time jobs to BACKLOG.md
---

# Cron

Use the native `cron` tool to schedule reminders and recurring tasks. 
All tasks are automatically persisted to the `BACKLOG.md` file.

## Actions

- **add** — Create a new scheduled job
- **list** — List all active jobs
- **remove** — Cancel a job by title

## Categories and Time Format

When adding a task, you MUST specify a `category`, `time_spec`, and `title`. `description` is optional but recommended.

| Category | time_spec Example | Description |
| -------- | ----------------- | ----------- |
| `One Shot Tasks` | `2026-05-04 10:00` | A single reminder that fires once and is then deleted. |
| `Daily Tasks` | `09:00` | Fires every day at the given time. |
| `Weekly Tasks` | `Wednesday 09:00` | Fires every week on the specified day and time. |
| `Monthly Tasks` | `25th 10:00` | Fires every month on the specified date and time. |

## Examples

### 1. Add a One-Shot Reminder
```json
{
  "action": "add",
  "category": "One Shot Tasks",
  "time_spec": "2026-05-04 14:30",
  "title": "Call dentist",
  "description": "- Ask about the new appointment slots\n- Check insurance coverage"
}
```

### 2. Add a Daily Task
```json
{
  "action": "add",
  "category": "Daily Tasks",
  "time_spec": "08:45",
  "title": "Morning Standup",
  "description": "Join the daily engineering sync."
}
```

### 3. Remove a Task
```json
{
  "action": "remove",
  "title": "Call dentist"
}
```

## Important Notes
- Always check the current time before scheduling a One Shot Task to ensure the `time_spec` is in the future.
- When a task fires, the system will trigger you to perform it. You must use the `message` tool to notify the user if the task requires notifying them.
