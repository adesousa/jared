---
name: alerting
description: Analyzes the tail end of local or remote log files to perform a health check, identifying issues, errors, or concerning patterns.
---

# Log Health Check Analyzer

## Description

This skill analyzes the tail end of log files (either local or remote) to perform a sanity/health check. It identifies issues, errors, or concerning patterns and outputs a clear, emoji-coded summary.

## Inputs

- `TARGET`: The log source. This can be a local file path (e.g., `/var/log/syslog`) or a remote URL (e.g., `https://example.com/logs/app.log`).
- `LINES` (Optional): The number of lines to analyze from the end of the file. Default is 50.

## Instructions for the Agent

1. **Fetch the Logs:**
   - If `TARGET` is a local file path: Execute `tail -n {LINES} {TARGET}` to retrieve the logs.
   - If `TARGET` is a URL: Execute `curl -s {TARGET} | tail -n {LINES}` to retrieve the logs.
   - If no logs are found or the file is empty, stop and output: "⚠️ No log entries found to analyze."

2. **Analyze the Logs:**
   Review the fetched log entries carefully for:
   - Error codes, exceptions, or stack traces.
   - Warnings or deprecation notices.
   - Unusual patterns (e.g., repeated authentication failures, timeouts).
   - Expected routine operations (to confirm healthy status).

3. **Format the Output:**
   Do not include preamble or conversational filler. Output _only_ the formatted health check summary exactly as structured below:

   📊 **LOG HEALTH CHECK RESULT**

   **1. Overall Status:**
   [Choose ONE emoji and status based on the analysis]
   - 🟢 **Healthy** (Normal operations, no significant warnings/errors)
   - 🟡 **Warning** (Non-critical issues, slow performance, or elevated warnings)
   - 🔴 **Critical** (Errors, crashes, or severe anomalies detected)

   **2. Key Findings:**
   - [Bullet point 1: concise description of a pattern or issue]
   - [Bullet point 2: include specific error codes or timestamps if relevant]

   **3. Recommended Actions:**
   - [Bullet point 1: actionable step, e.g., "Investigate database connection timeout on line 42"]
   - [Bullet point 2: actionable step, e.g., "No action needed, system operating normally"]

## Context / System Prompt

You must cut through the noise of standard informational logs and immediately identify anomalies, errors, or warnings. Your output must be brief, highly readable, and structured exactly as requested.
