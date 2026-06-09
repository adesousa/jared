---
name: weather
description: Get current weather and forecasts (no API key required). Use the `run_terminal_command` tool for execution.
---

# Weather Utility Guide

This tool provides two methods for retrieving weather information: `wttr.in` (quick shell commands) and Open-Meteo (JSON API access). Always use the appropriate format codes listed below. Ensure you use standard shell commands like `curl -s` when invoking these scripts.

## wttr.in (Primary - Quick CLI Access)

Use this for fast, interactive weather checks. These commands are designed to run directly in a shell environment. **Always answer using Celsius (°C) and km/h.**

**Quick Status Check:**

```bash
curl -s "wttr.in/London?format=3"
# Example Output: London: ⛅️ +8°C
# Tip: Use ?0 for current weather only. Use ?1 for compact format.
curl -s "wttr.in/New+York?format=1"
```

**Detailed Information (Format Codes Explained):**
Use these codes to specify the output fields you want. Ensure you use `?` followed by the code, e.g., `%l`, `%t`, `%h`, `%w`.

- `%l`: Location name
- `%c`: Condition icon
- `%t`: Temperature
- `%h`: Humidity percentage
- `%w`: Wind speed
- `%m`: Moon phase

Full Forecast: Use `?T` to see a detailed forecast for several days consecutively.

```bash
curl -s "wttr.in/London?T"
# Output details will vary based on format requested.
```

**Usage Tips for wttr.in:**

1. **URL Encoding:** If querying cities with spaces, use URL encoding (e.g., `wttr.in/New+York`).
2. **Units:** Explicitly request metric units using `?m`. Request Imperial units using `?u`. Example: `curl -s "wttr.in/London?m"`.
3. **Time Scope:** Use `?1` for today only, `?0` for current weather, `?3` for the next 3 days.

**Important:** The `wttr.in` service is a third-party tool. Ensure that the service is operational and accessible from your environment. If you encounter issues, consider using alternative methods or APIs.

## Open-Meteo (Fallback - Programmatic JSON)

Use this method when programmatic access to structured data is required. This tool retrieves raw JSON which must be parsed by the agent. **Requires pre-determined Latitude and Longitude coordinates.**

**Invocation Structure:**
The primary use case is querying for current weather based on known coordinates. The structure below shows a typical request format:

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current_weather=true"
# Example (Latitude for London approx 51.5, Longitude approx -0.12):
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.12&current_weather=true"
```

**Important Guidelines for Open-Meteo:**

1. **Coordinate Lookup:** If you do not have coordinates, you must first use a separate tool or knowledge source to find the latitude and longitude for the desired location. Do not attempt direct queries without valid coordinates.
2. **Query Type:** Always include `&current_weather=true` if seeking immediate status information. For forecasts, adjust parameters as necessary based on the live API documentation schema.
3. **Output Parsing:** The output will be JSON data containing temperature, windspeed, and weathercode. The agent must correctly interpret these fields.

**Important:** The Open-Meteo API is a third-party service. Ensure that the API is operational and accessible from your environment. If you encounter issues, consider using alternative methods or APIs.

### Preventing Errors: Critical Checkpoints

**If you encounter an error like "Tool not found":**

1. **Verify Command Execution:** Ensure that the command executed is a valid shell execution (`curl ...`).
2. **Tool Name Consistency:** Ensure the tool name being called matches the intended utility (`weather` uses `wttr.in` or Open-Meteo structure).
3. **API Calls:** For API calls (Open-Meteo), ensure actual, valid Latitude and Longitude values are provided in the query string.

**Always remember:** All output from these tools must be interpreted based on the guidelines: Temperature in Celsius (°C) and Wind Speed in km/h.

**Important:** The `run_terminal_command` tool has restrictions on certain commands for security reasons. Commands like `cd`, `head`, `tail`, and `date` are not permitted. Ensure that your shell commands do not include these restricted commands to avoid execution errors.

**Example of a Restricted Command:**

```bash
# This command will fail due to the use of 'head'
curl -s "wttr.in/Ponte+da+Barca?format=%C+%t+%w+%p" | head -n 1
```

**Corrected Command:**

```bash
# This command will succeed
curl -s "wttr.in/Ponte+da+Barca?format=%C+%t+%w+%p"
```

By adhering to these guidelines and restrictions, you can effectively retrieve and interpret weather information using the `weather` tool.
