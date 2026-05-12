import test from "node:test";
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import MCPManager from "../src/mcp/index.js";

const originalConnect = Client.prototype.connect;
const originalListTools = Client.prototype.listTools;
const originalCallTool = Client.prototype.callTool;

test("MCPManager: initializes correctly", () => {
  const manager = new MCPManager({ test: 123 });
  assert.deepStrictEqual(manager.config, { test: 123 });
  assert.strictEqual(manager.servers.size, 0);
  assert.deepStrictEqual(manager.tools, []);
});

test("MCPManager: skips disabled servers", async () => {
  let connected = false;
  Client.prototype.connect = async () => { connected = true; };

  const manager = new MCPManager({
    servers: {
      test: { enabled: false, command: "echo" }
    }
  });

  await manager.initialize();
  assert.strictEqual(connected, false);
  assert.strictEqual(manager.servers.size, 0);

  Client.prototype.connect = originalConnect;
});

test("MCPManager: initializes stdio server and fetches tools", async () => {
  let connectTransport = null;
  Client.prototype.connect = async function(transport) {
    connectTransport = transport;
  };
  Client.prototype.listTools = async function() {
    return {
      tools: [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: { x: { type: "string" } } }
        }
      ]
    };
  };

  const manager = new MCPManager({
    servers: {
      stdio_server: { command: "echo", args: ["hello"] }
    }
  });

  await manager.initialize();

  assert.ok(connectTransport instanceof StdioClientTransport);
  assert.strictEqual(manager.servers.size, 1);
  assert.ok(manager.servers.has("stdio_server"));
  assert.strictEqual(manager.tools.length, 1);
  assert.deepStrictEqual(manager.tools[0], {
    type: "function",
    function: {
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: { x: { type: "string" } } }
    },
    _serverName: "stdio_server"
  });

  Client.prototype.connect = originalConnect;
  Client.prototype.listTools = originalListTools;
});

test("MCPManager: initializes SSE server", async () => {
  let connectTransport = null;
  Client.prototype.connect = async function(transport) {
    connectTransport = transport;
  };
  Client.prototype.listTools = async function() {
    return { tools: [] };
  };

  const manager = new MCPManager({
    servers: {
      sse_server: { url: "http://localhost:8080/sse" }
    }
  });

  await manager.initialize();

  assert.ok(connectTransport instanceof SSEClientTransport);
  assert.strictEqual(manager.servers.size, 1);

  Client.prototype.connect = originalConnect;
  Client.prototype.listTools = originalListTools;
});

test("MCPManager: initializes Streamable server", async () => {
  let connectTransport = null;
  Client.prototype.connect = async function(transport) {
    connectTransport = transport;
  };
  Client.prototype.listTools = async function() {
    return { tools: [] };
  };

  const manager = new MCPManager({
    servers: {
      stream_server: { url: "http://localhost:8080/stream", transport: "streamable" }
    }
  });

  await manager.initialize();

  assert.ok(connectTransport instanceof StreamableHTTPClientTransport);
  assert.strictEqual(manager.servers.size, 1);

  Client.prototype.connect = originalConnect;
  Client.prototype.listTools = originalListTools;
});

test("MCPManager: utility methods (getTools, getToolSchema, hasTool, getMCPContext)", async () => {
  Client.prototype.connect = async function() {};
  Client.prototype.listTools = async function() {
    return {
      tools: [
        { name: "tool1", description: "First tool", inputSchema: { t: "1" } },
        { name: "tool2", inputSchema: { t: "2" } }
      ]
    };
  };

  const manager = new MCPManager({
    servers: { s1: { command: "echo" } }
  });
  await manager.initialize();

  // getTools
  const tools = manager.getTools();
  assert.strictEqual(tools.length, 2);
  assert.deepStrictEqual(tools[0], {
    type: "function",
    function: { name: "tool1", description: "First tool", parameters: { t: "1" } }
  });

  // getToolSchema
  assert.deepStrictEqual(manager.getToolSchema("tool1"), { t: "1" });
  assert.strictEqual(manager.getToolSchema("nonexistent"), null);

  // hasTool
  assert.strictEqual(manager.hasTool("tool2"), true);
  assert.strictEqual(manager.hasTool("nonexistent"), false);

  // getMCPContext
  const context = manager.getMCPContext();
  assert.ok(context.includes("- **tool1** [from s1]: First tool"));
  assert.ok(context.includes("- **tool2** [from s1]: No description available."));

  // getMCPContext empty
  const emptyManager = new MCPManager({});
  assert.strictEqual(emptyManager.getMCPContext(), "");

  Client.prototype.connect = originalConnect;
  Client.prototype.listTools = originalListTools;
});

test("MCPManager: executeTool calls underlying client", async () => {
  Client.prototype.connect = async function() {};
  Client.prototype.listTools = async function() {
    return {
      tools: [{ name: "action", description: "Action tool", inputSchema: {} }]
    };
  };
  let calledName = null;
  let calledArgs = null;
  Client.prototype.callTool = async function({ name, arguments: args }) {
    calledName = name;
    calledArgs = args;
    return { content: [{ text: "success" }] };
  };

  const manager = new MCPManager({
    servers: { s1: { command: "echo" } }
  });
  await manager.initialize();

  // with JSON string
  let result = await manager.executeTool("action", '{"arg1": "val1"}');
  assert.strictEqual(calledName, "action");
  assert.deepStrictEqual(calledArgs, { arg1: "val1" });
  assert.deepStrictEqual(result, { content: [{ text: "success" }] });

  // with Object
  result = await manager.executeTool("action", { arg2: "val2" });
  assert.strictEqual(calledName, "action");
  assert.deepStrictEqual(calledArgs, { arg2: "val2" });

  // not found
  await assert.rejects(
    async () => {
        await manager.executeTool("nonexistent", {});
    },
    /MCP Tool nonexistent not found/
  );

  Client.prototype.connect = originalConnect;
  Client.prototype.listTools = originalListTools;
  Client.prototype.callTool = originalCallTool;
});

test("MCPManager: handles server load errors gracefully", async () => {
  const originalError = console.error;
  let errorLogged = false;
  console.error = () => { errorLogged = true; };

  Client.prototype.connect = async function() {
    throw new Error("Connection failed");
  };

  const manager = new MCPManager({
    servers: { fail_server: { command: "echo" } }
  });

  await manager.initialize(); // should not throw, just log error

  assert.strictEqual(errorLogged, true);
  assert.strictEqual(manager.servers.size, 0);

  console.error = originalError;
  Client.prototype.connect = originalConnect;
});
