---
name: AI Agent Tool Executor
description: Executes tools for AI agents, ensuring correct parameter formats and preventing common execution errors.
metadata:
  author: AI Systems Team
  version: "1.1"
---

# AI Agent Tool Executor

## When to use this skill

Use when the AI agent needs to execute external tools, such as APIs, scripts, or system commands, ensuring correct parameter formats and preventing common execution errors.

## Instructions

1. **Parameter Validation**: Validate all input parameters to ensure they conform to the expected formats. This validation includes:
   - Ensuring that required fields are present.
   - Checking for correct data types, for example, URLs should start with `http://` or `https://` and contain no spaces.
   - Verifying that custom selectors are valid CSS selectors.

2. **Error Handling**: Implement robust error handling through:
   - Clear error messages that specify what went wrong.
   - Graceful fallbacks or retries for common transient errors.

3. **Security Measures**: Enforce security best practices by:
   - Sanitizing inputs thoroughly to prevent injection and path traversal attacks.
   - Restricting access to system commands that could compromise the system. Allow only a specific set of commands deemed safe.

4. **Logging and Monitoring**: Keep detailed logs, including:
   - Timestamps, user inputs, outputs, and any errors encountered.
   - Regular monitoring of the logs to preemptively resolve repeat issues.

5. **Timeouts and Resource Limits**: Set strict timeouts for tool executions. Ensure:
   - Tool processes do not hang indefinitely and consume excessive resources.
   - Define resource limits such as memory and processing time.

6. **Testing and Validation**: Rigorously test any new tools or updates. This includes:
   - Confirming that all edge cases are covered.
   - Validating the functionality interacts correctly within the agent’s environment.

## Warnings

- **Infinite Loops**: Avoid potential infinite loops due to repetitive tool calls without progress. Implement checks to detect and prevent such scenarios.
  
- **Tool Misuse**: Ensure proper argument usage. Incorrect or malformed arguments can lead to failures or unexpected behavior, including potential crashes.

- **Security Risks**: Unauthorized tool executions can introduce vulnerabilities. Always validate inputs rigorously and limit access permissions to only what is necessary.

- **File and Directory Access**: Be aware of workspace boundaries. Accessing or writing to locations outside preconfigured directories can lead to errors.

## Usage Examples

**Valid Tool Execution:**

```python
def execute_tool(tool_name, parameters):
    # Validate parameters
    if not validate_parameters(parameters):
        raise ValueError("Invalid parameters")

    # Execute the tool safely
    try:
        result = call_tool(tool_name, parameters)
        if result.success:
            return result.data
        else:
            handle_error(result.error)
    except Exception as e:
        print(f"Execution failed: {str(e)}")
```

**Invalid Tool Execution:**

```python
def execute_tool(tool_name, parameters):
    # Missing parameter validation leads to potential misuse
    result = call_tool(tool_name, parameters)  # This might fail unexpectedly
    return result.data
```

## Tips

- **Parameter Format**: Clearly document the expected parameter formats for each tool. For example, URLs should be valid and follow standard conventions.
  
- **Error Messages**: Use descriptive error messages to quickly guide users in understanding the issue.

- **Security Practices**: Regularly review and update permission settings and allowed command lists to mitigate new vulnerabilities.

- **Resource Management**: Implement monitoring to prevent excessive use and ensure balanced resource allocation.

- **Testing**: Utilize comprehensive unit and integration tests to ensure tool functions as intended under various scenarios.

By adhering to these guidelines, you can enhance the reliability, security, and efficiency of your AI agent's tool execution capabilities while avoiding common pitfalls and security risks.