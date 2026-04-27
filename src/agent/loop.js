import { EventEmitter } from "node:events";
import bus from "../bus/index.js";

class AgentLoop extends EventEmitter {
  constructor(context, memory, skills, mcp, provider, maxIterations = 15) {
    super();
    this.context = context;
    this.memory = memory;
    this.skills = skills;
    this.mcp = mcp;
    this.provider = provider;
    this.maxIterations = maxIterations;
    this.isRunning = false;
  }
  async runTask(
    taskRequest,
    session_id,
    user_id,
    skillsContext = "",
    mcpContext = "",
    onToken = null
  ) {
    this.isRunning = true;
    bus.emit("task:start");
    const tokenUsage = { promptTokens: 0, completionTokens: 0 };
    try {
      // Basic event loop placeholder
      let messages = await this.context.buildPrompt(
        taskRequest,
        session_id,
        user_id,
        skillsContext,
        mcpContext
      );
      // Loop until task is complete or max iterations reached
      for (let i = 0; i < this.maxIterations; i++) {
        const response = await this.provider.chat(
          messages,
          this.skills.getTools(),
          onToken
        );
        // Accumulate token usage from each LLM call
        if (response.usage) {
          tokenUsage.promptTokens += response.usage.promptTokens;
          tokenUsage.completionTokens += response.usage.completionTokens;
        }
        // Task completed
        if (!response.tool_calls || response.tool_calls.length === 0) {
          this.emit("taskCompleted", response.content);
          return { content: response.content, usage: tokenUsage };
        }
        // Handle tool calls
        messages.push(response.message);
        for (const toolCall of response.tool_calls) {
          bus.emit("tool:start", { 
            name: toolCall.function.name, 
            args: toolCall.function.arguments 
          });
          let result;
          if (this.mcp.hasTool(toolCall.function.name)) {
            result = await this.mcp.executeTool(
              toolCall.function.name,
              toolCall.function.arguments
            );
          } else {
            result = await this.skills.executeTool(
              toolCall.function.name,
              toolCall.function.arguments
            );
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(result)
          });
        }
      }
      const fallbackContent = "I have reached the maximum number of iterations allowed for this task without completing it. Please try refining your request or breaking it down into smaller steps.";
      this.emit("taskCompleted", fallbackContent);
      return { content: fallbackContent, usage: tokenUsage };
    } catch (error) {
      this.emit("error", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}
export default AgentLoop;
