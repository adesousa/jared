import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

class MCPManager {
  constructor(config = {}) {
    this.config = config;
    this.servers = new Map();
    this.tools = [];
  }

  async initialize() {
    for (const [name, serverConfig] of Object.entries(
      this.config.servers || {}
    )) {
      if (serverConfig.enabled === false) {
        continue;
      }

      try {
        let transport;
        if (serverConfig.command) {
          transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args || [],
            env: serverConfig.env || process.env
          });
        } else if (serverConfig.url) {
          if (serverConfig.transport === "streamable") {
            transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
              requestInit: { headers: serverConfig.headers }
            });
          } else {
            transport = new SSEClientTransport(new URL(serverConfig.url), {
              headers: serverConfig.headers
            });
          }
        }

        if (transport) {
          const client = new Client(
            { name: "jared", version: "1.0.0" },
            { capabilities: {} }
          );
          await client.connect(transport);
          this.servers.set(name, client);

          // Fetch tools from the connected server
          const toolsResult = await client.listTools();
          for (const tool of toolsResult.tools) {
            this.tools.push({
              type: "function",
              function: {
                name: tool.name, // Will be mapped natively
                description: tool.description,
                parameters: tool.inputSchema
              },
              _serverName: name // internal reference
            });
          }
        }
      } catch (err) {
        console.error(`Failed to load MCP server ${name}:`, err);
      }
    }
  }
  // Return standard tool array without internal properties
  getTools() {
    return this.tools.map(t => ({
      type: t.type,
      function: t.function
    }));
  }

  getMCPContext() {
    if (this.tools.length === 0) return "";

    const sections = this.tools.map(tool => {
      const desc = tool.function.description ? tool.function.description : "No description available.";
      return `- **${tool.function.name}** [from ${tool._serverName}]: ${desc}`;
    });

    return `\n## Available MCP Tools\nYou have the following external MCP tools available. Use the \`get_mcp_tool_schema\` tool to read the exact arguments required for any of these tools before using them with \`execute_mcp_tool\`:\n${sections.join("\n")}\n`;
  }

  getToolSchema(name) {
    const toolDef = this.tools.find(t => t.function.name === name);
    if (!toolDef) return null;
    return toolDef.function.parameters;
  }

  hasTool(name) {
    return this.tools.some(t => t.function.name === name);
  }

  async executeTool(name, argsJson) {
    const toolDef = this.tools.find(t => t.function.name === name);
    if (!toolDef) throw new Error(`MCP Tool ${name} not found.`);

    const client = this.servers.get(toolDef._serverName);
    const args = typeof argsJson === "string" ? JSON.parse(argsJson) : argsJson;
    const result = await client.callTool({
      name: name,
      arguments: args
    });

    return result;
  }
}

export default MCPManager;
