---
name: monitoring
description: Monitor environment health by checking URLs with 'curl -o /dev/null --max-time 5 -s -w "%{http_code}\n"' and analyzing failures with LLM.
---

# Monitoring

Monitor the health status of environments by performing HTTP checks on provided URLs. The skill uses `curl` to verify connectivity and HTTP status codes, with automatic LLM-powered analysis for failures.

## Quick Start

Check a single environment:

```bash
curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://api.example.com/health"
```

## How It Works

1. **Health Check**: Performs a silent curl request (`curl -s`) to the environment URL
2. **Status Detection**:
   - ✅ **Healthy**: No stderr output = HTTP 200 (success)
   - ❌ **Unhealthy**: stderr output or timeout = error state
3. **Analysis**: On failure, sends error details to LLM for diagnosis and solutions
4. **Reporting**: Displays results in consistent emoji-based format

## Response Format / Output Format

### Healthy Environment

```
✅ {environment_name} : healthy
Status: 200
```

### Unhealthy Environment

```
⚠️ {environment_name} curl stderr: {error_message}
Status: ERROR
Analysis: {LLM-generated explanation and solutions}
```

### Connection Failure

```
❌ {environment_name} curl failed: {error_message}
Status: ERROR
Analysis: {LLM-generated explanation and solutions}
```

## Parameters

When monitoring an environment, provide:

- **name**: Display name of the environment (e.g., "Production API", "Staging DB")
- **url**: Full URL to check (e.g., "https://api.example.com/health")

## Examples

### Monitor Production API

```bash
curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://api.production.com/health"
```

### Monitor with Timeout

The skill automatically applies a 5-second timeout to prevent hanging:

```bash
curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://slow-service.example.com/status"
# Will timeout and trigger LLM analysis if no response within 5s
```

### Monitor Multiple Environments

Check each environment sequentially:

```bash
 curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://api.prod.com/health"
 curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://api.staging.com/health"
 curl -o /dev/null --max-time 5 -s -w "%{http_code}\n" "https://api.dev.com/health"
```

## LLM Analysis

When a health check fails, the LLM receives:

- Environment name
- URL that was checked
- Error message or stderr output
- Timeout information (if applicable)

The LLM provides:

- Concise explanation of the issue
- Potential root causes
- Suggested solutions
- Emoji-enhanced formatting for clarity

## Tips

- Always provide the full URL including protocol (`https://` or `http://`)
- Review LLM analysis to understand recurring failure patterns
- Check network connectivity if multiple environments fail simultaneously
