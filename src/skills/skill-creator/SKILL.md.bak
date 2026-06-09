---
name: AI Agent Tool Executor
description: Executes tools for AI agents, ensuring correct parameter formats and preventing common execution errors.
metadata:
  author: AI Systems Team
  version: "1.0"
---

# AI Agent Tool Executor

## When to use this skill

Use when the AI agent needs to execute external tools, such as APIs, scripts, or system commands, ensuring correct parameter formats and preventing common execution errors.

## Instructions

1. **Parameter Validation**: Before executing any tool, validate all input parameters to ensure they conform to the expected formats. This includes checking for correct data types, required fields, and valid values.

2. **Error Handling**: Implement robust error handling to manage unexpected inputs or execution failures. Provide clear error messages and fallback mechanisms to maintain system stability.

3. **Security Measures**: Ensure that all tool executions are secure by sanitizing inputs to prevent injection attacks and by restricting access to sensitive system resources.

4. **Logging and Monitoring**: Maintain detailed logs of all tool executions, including inputs, outputs, and any errors encountered. Monitor these logs regularly to identify and address potential issues proactively.

5. **Timeouts and Resource Limits**: Set appropriate timeouts and resource usage limits for tool executions to prevent infinite loops, excessive resource consumption, and potential denial-of-service conditions.

6. **Testing and Validation**: Before deploying new tools or updates, conduct thorough testing to ensure they function correctly within the agent's environment and handle edge cases gracefully.

## Warnings

- **Infinite Loops**: Be cautious of scenarios where the agent might enter an infinite loop due to repetitive tool calls without progress. Implement checks to detect and prevent such loops.

- **Tool Misuse**: Ensure that tools are called with the correct arguments and handle error responses appropriately. Misuse can lead to incorrect outputs and system instability.

- **Security Risks**: Unauthorized tool executions can lead to security vulnerabilities. Always validate inputs and restrict tool access to necessary components only.

## Usage Examples

**Valid Tool Execution:**

```python
def execute_tool(tool_name, parameters):
    # Validate parameters
    if not validate_parameters(parameters):
        raise ValueError("Invalid parameters")
    
    # Execute the tool
    result = call_tool(tool_name, parameters)
    
    # Handle result
    if result.success:
        return result.data
    else:
        handle_error(result.error)
```

**Invalid Tool Execution:**

```python
def execute_tool(tool_name, parameters):
    # Missing parameter validation
    result = call_tool(tool_name, parameters)
    return result.data  # Potential misuse if result is not checked
```

## Tips

- **Parameter Format**: Clearly define and document the expected parameter formats for each tool to prevent misuse and errors.

- **Error Messages**: Provide informative error messages that can help in diagnosing issues quickly.

- **Security Practices**: Regularly review and update security measures to address new vulnerabilities and threats.

- **Resource Management**: Monitor resource usage to prevent excessive consumption and ensure fair allocation among tasks.

- **Testing**: Implement unit tests and integration tests to verify tool functionality and integration within the agent's workflow.

By following these guidelines, you can enhance the reliability, security, and efficiency of your AI agent's tool execution capabilities.