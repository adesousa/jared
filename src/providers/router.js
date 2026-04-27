import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

class ProviderRouter {
  constructor(config = {}) {
    this.activeProviderName = config.agents?.defaults?.provider;
    this.thinking = config.agents?.defaults?.thinking ?? true;
    
    const activeProvider = this.activeProviderName
      ? config.providers?.[this.activeProviderName]
      : null;
    this.model =
      config.agents?.defaults?.model || activeProvider?.keys?.[0]?.models?.[0];
    const apiKey = activeProvider?.keys?.[0]?.value;
    if (this.activeProviderName === "gemini") {
      this.isGemini = true;
      if (!apiKey) throw new Error("Missing Gemini API Key in config");
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.isGemini = false;
      const baseURL = activeProvider?.url || "https://api.openai.com/v1";
      this.openai = new OpenAI({ baseURL, apiKey: apiKey });
    }
  }

  setModel(modelName) {
    this.model = modelName;
  }

  async chat(messages, tools = [], onToken = null) {
    return this.isGemini
      ? this._chatGemini(messages, tools, onToken)
      : this._chatOpenAI(messages, tools, onToken);
  }

  async _chatOpenAI(messages, tools = [], onToken = null) {
    const params = { model: this.model, messages };
    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }
    params.extra_body = {
      chat_template_kwargs: { enable_thinking: this.thinking }
    };

    if (!onToken) {
      const response = await this.openai.chat.completions.create(params);
      const message = response.choices[0].message;
      let content = message.content;
      if (Array.isArray(content))
        content = content
          .filter(p => p.type === "text")
          .map(p => p.text)
          .join("");
      return {
        content,
        tool_calls: message.tool_calls || [],
        message: { ...message, content },
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        }
      };
    }

    try {
      params.stream = true;
      params.stream_options = { include_usage: true };
      const stream = await this.openai.chat.completions.create(params);
      let fullContent = "",
        toolCallsMap = new Map();
      let promptTokens = 0,
        completionTokens = 0;

      for await (const chunk of stream) {
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens || promptTokens;
          completionTokens = chunk.usage.completion_tokens || completionTokens;
        }
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          fullContent += delta.content;
          onToken(delta.content);
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsMap.has(tc.index))
              toolCallsMap.set(tc.index, {
                id: tc.id,
                type: "function",
                function: { name: tc.function.name || "", arguments: "" }
              });
            if (tc.function?.name)
              toolCallsMap.get(tc.index).function.name = tc.function.name;
            if (tc.function?.arguments)
              toolCallsMap.get(tc.index).function.arguments +=
                tc.function.arguments;
          }
        }
      }

      const parsedToolCalls = Array.from(toolCallsMap.values());
      return {
        content: fullContent,
        tool_calls: parsedToolCalls,
        message: {
          role: "assistant",
          content: fullContent,
          tool_calls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined
        },
        usage: { promptTokens, completionTokens }
      };
    } catch (e) {
      if (
        e.message &&
        (e.message.toLowerCase().includes("stream") ||
          e.message.toLowerCase().includes("usage"))
      )
        return this._chatOpenAI(messages, tools, null);
      throw e;
    }
  }

  async _chatGemini(messages, tools = [], onToken = null) {
    let systemInstruction = undefined;
    const contents = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls?.length > 0) {
          contents.push({
            role: "model",
            parts: msg.tool_calls.map(tc => {
              const funcCall = {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              };
              if (tc.function.thought_signature)
                funcCall.thought_signature = tc.function.thought_signature;
              return { functionCall: funcCall };
            })
          });
        } else {
          contents.push({
            role: "model",
            parts: [{ text: msg.content || "" }]
          });
        }
      } else if (msg.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: { name: msg.name, content: msg.content }
              }
            }
          ]
        });
      }
    }

    const geminiTools =
      tools.length > 0
        ? [
            {
              functionDeclarations: tools.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
              }))
            }
          ]
        : undefined;
    const modelInstance = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction,
      tools: geminiTools
    });
    let response,
      fullContent = "";

    if (onToken) {
      try {
        const result = await modelInstance.generateContentStream({ contents });
        for await (const chunk of result.stream) {
          try {
            const chunkText = chunk.text();
            if (chunkText) {
              fullContent += chunkText;
              onToken(chunkText);
            }
          } catch (e) {}
        }
        response = await result.response;
      } catch (e) {
        return this._chatGemini(messages, tools, null);
      }
    } else {
      const result = await modelInstance.generateContent({ contents });
      response = result.response;
      try {
        fullContent = response.text();
      } catch (e) {}
    }

    const parsedToolCalls = [];
    const rawFunctionCallParts = (
      response?.candidates?.[0]?.content?.parts || []
    ).filter(p => p.functionCall);
    for (const p of rawFunctionCallParts) {
      parsedToolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "function",
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args)
        }
      });
    }

    let promptTokens = 0,
      completionTokens = 0;
    if (response?.usageMetadata) {
      promptTokens = response.usageMetadata.promptTokenCount || 0;
      completionTokens = response.usageMetadata.candidatesTokenCount || 0;
    }

    return {
      content: fullContent,
      tool_calls: parsedToolCalls,
      message: {
        role: "assistant",
        content: fullContent,
        tool_calls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined
      },
      usage: { promptTokens, completionTokens }
    };
  }
}

export default ProviderRouter;
