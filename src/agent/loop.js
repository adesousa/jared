import { EventEmitter } from "node:events";
import bus from "../bus/index.js";
import { logger } from "../utils/index.js";

class AgentLoop extends EventEmitter {
  constructor(
    context,
    memory,
    skills,
    mcp,
    provider,
    maxIterations = 15,
    systemPromptInterval = 5,
    config = {}
  ) {
    super();
    this.context = context;
    this.memory = memory;
    this.skills = skills;
    this.mcp = mcp;
    this.provider = provider;
    this.maxIterations = maxIterations;
    this.systemPromptInterval = systemPromptInterval;
    this.config = config;
    this.isRunning = false;
  }

  async compactHistory(session_id, user_id, keepCount) {
    const allMsgs = await this.memory.getFullSessionMessages(session_id);
    if (allMsgs.length <= keepCount + 2) {
      return;
    }

    const messagesToCompact = allMsgs.slice(0, allMsgs.length - keepCount);
    const messagesToKeep = allMsgs.slice(allMsgs.length - keepCount);

    const chatLog = messagesToCompact
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const compactionPrompt = [
      {
        role: "system",
        content: `You are an internal system memory compaction utility. 
Your task is to analyze the preceding chat history between the User and the Assistant and extract:
1. Core Facts (any persistent facts, project specs, directories, or state details mentioned).
2. Preferences (any user preferences or style guidelines).
3. Rules (any explicit directives or instructions the user wants the assistant to follow).
4. Summaries (a concise summary of what has been discussed/done in this session so far).

Format your output as a series of instructions to create memories, using this exact format:
[FACT] <fact content>
[PREFERENCE] <preference content>
[RULE] <rule content>
[SUMMARY] <summary of conversation so far>

Return ONLY this formatted block. Do not include any greeting or explanation.`
      },
      {
        role: "user",
        content: `Here is the chat history to compact:\n\n${chatLog}`
      }
    ];

    try {
      logger.info("[Compaction] Requesting compaction summary from LLM...");
      const response = await this.provider.chat(compactionPrompt, []);
      const content = response.content;

      const lines = content.split("\n");
      for (const line of lines) {
        const match = line.match(/^\[(FACT|PREFERENCE|RULE|SUMMARY)\]\s*(.*)$/i);
        if (match) {
          const category = match[1].toLowerCase();
          const memoryContent = match[2].trim();
          if (memoryContent) {
            logger.info(`[Compaction] Storing memory: [${category}] ${memoryContent}`);
            await this.memory.addCoreMemory(user_id, memoryContent, category);
          }
        }
      }

      const keepIds = messagesToKeep.map(m => m.id);
      await this.memory.truncateSessionMessages(session_id, keepIds);
      logger.info(`[Compaction] Session history truncated. Retained ${keepCount} messages in DB.`);
    } catch (err) {
      logger.error("[Compaction] Error during history compaction:", err);
    }
  }

  async runTask(
    taskRequest,
    session_id,
    user_id,
    skillsContext = "",
    mcpContext = "",
    onToken = null,
    noContext = false
  ) {
    this.isRunning = true;
    bus.emit("task:start", { sessionId: session_id, userId: user_id, channel: this.channel });
    const tokenUsage = { promptTokens: 0, completionTokens: 0 };
    let activeSkill = null;
    let reviewCount = 0;
    try {
      if (this.skills && typeof this.skills.getLoadedSkills === "function") {
        const loadedSkills = this.skills.getLoadedSkills();
        const taskLower = taskRequest.toLowerCase();
        for (const skill of loadedSkills) {
          if (
            taskLower.includes(skill.folderName.toLowerCase()) ||
            taskLower.includes(skill.name.toLowerCase())
          ) {
            activeSkill = skill.folderName;
            break;
          }
        }
        if (!activeSkill && this.memory && typeof this.memory.getRecentContext === "function") {
          const history = await this.memory.getRecentContext(session_id, 20);
          for (const msg of history) {
            const contentLower = msg.content.toLowerCase();
            for (const skill of loadedSkills) {
              if (
                contentLower.includes(skill.folderName.toLowerCase()) ||
                contentLower.includes(skill.name.toLowerCase())
              ) {
                activeSkill = skill.folderName;
                break;
              }
            }
            if (activeSkill) break;
          }
        }
      }
    } catch (e) {
      logger.error("[Loop] Error detecting active skill:", e);
    }

    try {
      // Phase 2: In-Session Compaction Check
      try {
        if (!noContext && this.memory && typeof this.memory.getRecentContext === "function") {
          const compactionThreshold = this.config.agents?.defaults?.compactionThreshold ?? 20000;
          const compactionKeepCount = this.config.agents?.defaults?.compactionKeepCount ?? 6;

          // Fetch recent context history to evaluate size
          const history = await this.memory.getRecentContext(session_id, 100);
          const sampleMessages = [...history, { role: "user", content: taskRequest }];
          const approxTokens = Math.ceil(JSON.stringify(sampleMessages).length / 4);

          if (approxTokens > compactionThreshold) {
            logger.info(
              `[Compaction] Active history has ~${approxTokens} tokens, exceeding threshold of ${compactionThreshold}. Triggering compaction...`
            );
            await this.compactHistory(session_id, user_id, compactionKeepCount);
          }
        }
      } catch (err) {
        logger.error("[Compaction] Error checking compaction threshold:", err);
      }

      let messages = await this.context.buildPrompt(
        taskRequest,
        session_id,
        user_id,
        skillsContext,
        mcpContext,
        noContext
      );

      // Phase 3: Pre-execution warnings for tool failures
      try {
        if (this.memory && typeof this.memory.getRecentFailures === "function") {
          const activeTools = this.skills.getTools();
          const warnings = [];
          for (const t of activeTools) {
            const failures = await this.memory.getRecentFailures(t.function.name, 1);
            if (failures && failures.length > 0) {
              warnings.push(
                `- Tool '${t.function.name}' failed recently with: "${failures[0].error_message}"`
              );
            }
          }
          if (warnings.length > 0) {
            const warningsBlock = `\n\n### WARNINGS: Lessons from Recent Tool Failures\nAdjust your arguments to avoid repeating these mistakes:\n${warnings.join("\n")}`;
            messages[0].content += warningsBlock;
          }
        }
      } catch (err) {
        logger.error("Error gathering tool warnings:", err);
      }

      // Separate the full system prompt from the rest of the conversation
      const fullSystemMessage = messages[0];
      const slimSystemMessage = {
        role: "system",
        content: `Continue the task based on the conversation so far.\n\n${skillsContext}\n${mcpContext}`
      };

      for (let i = 0; i < this.maxIterations; i++) {
        const useFullSystem = i === 0 || i % this.systemPromptInterval === 0;
        messages[0] = useFullSystem ? fullSystemMessage : slimSystemMessage;
        if (useFullSystem && i > 0) {
          logger.debug(`[Loop] Re-injecting full system prompt at iteration ${i}`);
        }

        const wrappedOnToken = onToken ? token => onToken(token, reviewCount + 1) : null;
        const response = await this.provider.chat(
          messages,
          this.skills.getTools(),
          wrappedOnToken
        );

        if (onToken && response.content) {
          process.stdout.write("\n");
        }

        if (response.usage) {
          tokenUsage.promptTokens += response.usage.promptTokens;
          tokenUsage.completionTokens += response.usage.completionTokens;
        }

        if (!response.tool_calls || response.tool_calls.length === 0) {
          // Phase 5: Self-Review Critic Loop
          const selfReviewEnabled = !noContext && (this.config.agents?.defaults?.selfReview ?? true);
          if (selfReviewEnabled && reviewCount < 2) {
            reviewCount++;
            console.log(`\x1b[36m[Self-Review] Initiating final answer review (Attempt ${reviewCount}/2)...\x1b[0m`);
            const criticPrompt = [
              {
                role: "system",
                content: `You are an independent quality assurance critic. 
Your job is to review the Assistant's final answer against the User's initial task request and the conversation history.
Determine if the Assistant has fully addressed all requirements of the request.
Provide a score between 1 and 10 and a concise explanation of your review.
Your response MUST use this exact format:
SCORE: <number between 1 and 10>
REASON: <concise explanation of what is missing or incorrect, and instructions for how to fix it>

Be strict. Do not accept placeholders, unfinished code, or skipped steps.`
              },
              {
                role: "user",
                content: `Initial Task Request: "${taskRequest}"\n\nProposed Final Answer:\n${response.content}`
              }
            ];

            try {
              const reviewRes = await this.provider.chat(criticPrompt, []);
              const criticFeedback = reviewRes.content.trim();

              let isPass = false;
              let failReason = "";
              let score = null;

              const scoreMatch = criticFeedback.match(/SCORE:\s*(\d+)/i);
              if (scoreMatch) {
                score = parseInt(scoreMatch[1], 10);
                isPass = score >= 6;
                const reasonMatch = criticFeedback.match(/REASON:\s*([\s\S]*)$/i);
                failReason = reasonMatch ? reasonMatch[1].trim() : criticFeedback;
              } else {
                // Fallback for backward compatibility (e.g. old PASS/FAIL format or tests)
                if (criticFeedback.startsWith("PASS")) {
                  isPass = true;
                  score = 10;
                } else if (criticFeedback.startsWith("FAIL:")) {
                  isPass = false;
                  score = 0;
                  failReason = criticFeedback.substring(5).trim();
                } else {
                  isPass = false;
                  score = 0;
                  failReason = criticFeedback;
                }
              }

              if (isPass) {
                console.log(`\x1b[32m[Self-Review] Score: ${score}/10. PASS. Final answer accepted.\x1b[0m`);
              } else {
                console.log(`\x1b[31m[Self-Review] Score: ${score ?? 0}/10. FAIL. Reason: ${failReason}\x1b[0m`);

                // Inject failure feedback
                messages.push(response.message);
                messages.push({
                  role: "user",
                  content: `[CRITICAL SELF-REVIEW FAILURE]\nYour proposed answer was reviewed and rejected for the following reason:\n\n${failReason}\n\nPlease correct the response, execute any necessary tools, and provide the fully completed final answer.`
                });
                continue;
              }
            } catch (reviewErr) {
              console.error("[Self-Review] Error during critic review:", reviewErr);
            }
          }

          this.emit("taskCompleted", response.content);
          return { content: response.content, usage: tokenUsage, attempt: Math.max(1, reviewCount) };
        }

        messages.push(response.message);

        // Phase 3: Tool Execution Tracing and Retries
        const toolPromises = response.tool_calls.map(async toolCall => {
          bus.emit("tool:start", {
            name: toolCall.function.name,
            args: toolCall.function.arguments,
            sessionId: session_id,
            userId: user_id,
            channel: this.channel
          });

          let result;
          let success = 1;
          let errorMessage = null;

          try {
            if (this.skills.hasTool && this.skills.hasTool(toolCall.function.name)) {
              result = await this.skills.executeTool(
                toolCall.function.name,
                toolCall.function.arguments
              );
            } else if (this.mcp.hasTool && this.mcp.hasTool(toolCall.function.name)) {
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

            const resultStr = typeof result === "string" ? result : JSON.stringify(result);
            if (
              resultStr.toLowerCase().includes("error") ||
              resultStr.toLowerCase().includes("failed")
            ) {
              success = 0;
              errorMessage = resultStr;
            }
          } catch (err) {
            success = 0;
            errorMessage = err.message || String(err);
            result = `Error: ${errorMessage}`;
          }

          if (toolCall.function.name === "read_skill_manual") {
            try {
              const args = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
              if (args && args.skill_name && this.skills && typeof this.skills.getLoadedSkills === "function") {
                const loadedSkills = this.skills.getLoadedSkills();
                const matched = loadedSkills.find(s => s.name.toLowerCase() === args.skill_name.toLowerCase() || s.folderName.toLowerCase() === args.skill_name.toLowerCase());
                if (matched) {
                  activeSkill = matched.folderName;
                }
              }
            } catch (e) {}
          }

          // Log trace
          try {
            if (this.memory && typeof this.memory.addTrace === "function") {
              await this.memory.addTrace(
                session_id,
                taskRequest,
                toolCall.function.name,
                toolCall.function.arguments,
                result,
                success,
                errorMessage,
                activeSkill
              );
            }
          } catch (traceErr) {
            logger.error(`Failed to log execution trace: ${traceErr.message}`);
          }

          logger.debug(`Tool '${toolCall.function.name}' execution completed.`);
          logger.debug(`Tool result:`, result);

          let contentValue = typeof result === "string" ? result : JSON.stringify(result);
          if (success === 0) {
            contentValue = `[SYSTEM WARNING] Tool '${toolCall.function.name}' execution failed. 
Error details: ${errorMessage}. 
Please write a <think> block analyzing why this tool call failed, fix your parameters/logic, and retry. 
If the tool is not available or keeps failing, try an alternative approach.

Original tool response: ${contentValue}`;
          }

          return {
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: contentValue
          };
        });

        const toolResults = await Promise.all(toolPromises);
        messages.push(...toolResults);
      }

      const fallbackContent =
        "I have reached the maximum number of iterations allowed for this task without completing it. Please try refining your request or breaking it down into smaller steps.";
      this.emit("taskCompleted", fallbackContent);
      return { content: fallbackContent, usage: tokenUsage, attempt: Math.max(1, reviewCount) };
    } catch (error) {
      this.emit("error", error);
      throw error;
    } finally {
      this.isRunning = false;
      bus.emit("task:end", { sessionId: session_id, userId: user_id, channel: this.channel });
    }
  }
}

export default AgentLoop;
