---
name: summarize
description: Summarize or extract text/transcripts from URLs, podcasts, and local files (great fallback for "transcribe this YouTube/video").
---

# Summarize

Fast CLI to summarize URLs, local files, and YouTube links.
Use the `exec` tool to run these commands.

## When to use (trigger phrases)

Use this skill immediately when the user asks any of:

- "what's this link/video about?"
- "summarize this URL/article"
- "transcribe this YouTube/video"

## Quick start

```bash
summarize "https://example.com" --model google/gemini-3-flash-preview
summarize "/path/to/file.pdf" --model google/gemini-3-flash-preview
summarize "https://youtu.be/dQw4w9WgXcQ" --youtube auto
```

## YouTube: summary vs transcript

Best-effort transcript (URLs only):

```bash
summarize "https://youtu.be/dQw4w9WgXcQ" --youtube auto --extract-only
```

If the user asked for a transcript but it's huge, return a tight summary first, then ask which section/time range to expand.

## Useful flags

- `--length short|medium|long|xl|xxl|<chars>`
- `--max-output-tokens <count>`
- `--extract-only` (URLs only)
- `--json` (machine readable)
