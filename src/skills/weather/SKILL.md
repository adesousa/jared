---
name: weather
description: Get current weather and forecasts (no API key required). Use the `run_terminal_command` tool for execution.
---

# Weather Utility Guide

This tool provides two methods for retrieving weather information: `wttr.in` (quick shell commands) and Open-Meteo (JSON API access). Always use the appropriate format codes listed below. Ensure you use standard shell commands like `curl -s` when invoking these scripts.

## wttr.in (Primary - Quick CLI Access)

Use this for fast, interactive weather checks. These commands are designed to run directly in a shell environment. **Always respond using Celsius (°C) and wind speed in km/h. Be aware of the correct command structure to avoid errors.**

### **Quick Status Check:**

```bash
curl -s "wttr.in/London?format=3"
# Example Output: London: ⛅️ +8°C
# Tip: Use ?0 for current weather only. Use ?1 for compact format.
curl -s "wttr.in/New+York?format=1"
```

### **Detailed Information (Format Codes Explained):**
Use these codes to specify the output fields you want. Ensure you use `?` followed by the code, e.g., `%l`, `%t`, `%h`, `%w`.

- `%l`: Location name
- `%c`: Condition icon
- `%t`: Temperature
- `%h`: Humidity percentage
- `%w`: Wind speed
- `%m`: Moon phase

**Full Forecast:** Use `?T` to see a detailed forecast for several days consecutively.

```bash
curl -s "wttr.in/London?T"
# Output details will vary based on format requested.
```

### **Usage Tips for wttr.in:**

1. **URL Encoding:** If querying cities with spaces, use URL encoding (e.g., `wttr.in/New+York`). 
2. **Units:** Explicitly request metric units using `?m`. Request Imperial units using `?u`. Example: `curl -s "wttr.in/London?m"`.
3. **Time Scope:** Use `?1` for today only, `?0` for current weather, `?3` for the next 3 days.

### **Important Warnings and Guidelines:**
- **Service Availability:** Always ensure the `wttr.in` service is operational and accessible from your environment.
- **Error Prevention:** 
  - Avoid using non-allowed commands (`cd`, `head`, `tail`, `date`).
  - Ensure all commands conform to the allowed command format.

## Open-Meteo (Fallback - Programmatic JSON)

Use this method when programmatic access to structured data is required. This tool retrieves raw JSON which must be parsed by the agent.  **Requires valid Latitude and Longitude coordinates.**

### **Invocation Structure:**
The primary use case is querying for current weather based on known coordinates. The structure below shows a typical request format:

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current_weather=true"
# Example (Latitude for London approx 51.5, Longitude approx -0.12):
curl -s "https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=-0.12&current_weather=true"
```

### **Important Guidelines for Open-Meteo:**
1. **Coordinate Lookup:** If you do not have coordinates, you must first use a separate tool or knowledge source to find the latitude and longitude for the desired location.
2. **Query Type:** Always include `&current_weather=true` if seeking immediate status information. For forecasts, adjust parameters as necessary based on the live API documentation.
3. **Output Parsing:** The JSON output will contain temperature, windspeed, and weathercode. The agent must correctly interpret these fields.

### **Preventing Errors: Critical Checkpoints**
**Common Errors to Avoid:**
- **"Tool not found" Errors:** 
  1. Ensure that the command you are executing is a valid shell command (`curl ...`).
  2. Verify that `weather` is the correct skill name being referenced.
  3. Check that you are providing valid Latitude and Longitude values for Open-Meteo requests.

### **General Usage Tips:**
- **Maintain Format Consistency:** All locations should be provided in a consistent format (e.g., `Ponte da Barca`).
- **Test Commands Separately:** Before running complex commands, test them in isolation to confirm they work.
- **Avoid Restricted Commands:** Ensure that commands do not include restricted keywords to prevent execution errors.

By adhering to these guidelines and restrictions, you can effectively retrieve and interpret weather information using the `weather` tool. Always verify the accessibility of the external services and maintain a clear structure in your commands.