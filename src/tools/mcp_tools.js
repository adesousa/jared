export default [
  {
    schema: {
      name: "get_mcp_tool_schema",
      description: "Get the required arguments schema for an MCP tool before executing it.",
      parameters: {
        type: "object",
        properties: {
          tool_name: {
            type: "string",
            description: "The exact name of the MCP tool to inspect."
          }
        },
        required: ["tool_name"]
      }
    },
    execute: async (args, context) => {
      const mcp = context.mcp;
      if (!mcp) return "Error: MCP Manager is not available.";
      
      const schema = mcp.getToolSchema(args.tool_name);
      if (!schema) return `Error: MCP tool '${args.tool_name}' not found.`;
      
      return JSON.stringify(schema, null, 2);
    }
  },
  {
    schema: {
      name: "execute_mcp_tool",
      description: "Execute an MCP tool by its name and provide arguments as a JSON string. Make sure you use get_mcp_tool_schema first to know what arguments are expected.",
      parameters: {
        type: "object",
        properties: {
          tool_name: {
            type: "string",
            description: "The exact name of the MCP tool to execute."
          },
          arguments_json: {
            type: "string",
            description: "The JSON-stringified arguments object matching the tool's schema."
          }
        },
        required: ["tool_name", "arguments_json"]
      }
    },
    execute: async (args, context) => {
      const mcp = context.mcp;
      if (!mcp) return "Error: MCP Manager is not available.";
      
      try {
        const parsedArgs = JSON.parse(args.arguments_json);
        const result = await mcp.executeTool(args.tool_name, parsedArgs);
        return result;
      } catch (err) {
        return `Error executing MCP tool '${args.tool_name}': ${err.message}`;
      }
    }
  }
];
