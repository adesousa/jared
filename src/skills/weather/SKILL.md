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
1. URL Encoding: If querying cities with spaces, use URL encoding (e.g., `wttr.in/New+York`).
2 Units: Explicitly request metric units using `?m`. Request Imperial units using `?u`. Example: `curl -s "wttr.in/London?m"`.
3 Time Scope: Use `?1` for today only, `?0` for current weather, `?3` for the next 3 days.

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
1. Coordinate Lookup: If you do not have coordinates, you must first use a separate tool or knowledge source to find the latitude and longitude for the desired location. Do not attempt direct queries without valid coordinates.
2 Query Type: Always include `&current_weather=true` if seeking immediate status information. For forecasts, adjust parameters as necessary based on the live API documentation schema.
3 Output Parsing: The output will be JSON data containing temperature, windspeed, and weathercode. The agent must correctly interpret these fields.

### Preventing Errors: Critical Checkpoints

**If you encounter an error like "Tool not found":**
1. Verify that the command executed is a valid shell execution (`curl ...`).
2 Ensure the tool name being called matches the intended utility (`weather` uses `wttr.in` or Open-Meteo structure).
3 For API calls (Open-Meteo), ensure actual, valid Latitude and Longitude values are provided in the query string.

**Always remember:** All output from these tools must be interpreted based on the guidelines: Temperature in Celsius (°C) and Wind Speed in km/h.