import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

class ProviderRouter {
  constructor(config = {}, providerOverride = null, modelOverride = null) {
    this.activeProviderName = providerOverride || config.agents?.defaults?.provider;
    this.thinking = config.agents?.defaults?.thinking ?? true;
    
    const activeProvider = this.activeProviderName
      ? config.providers?.[this.activeProviderName]
      : null;
      
    // Try to find the default model in the new "default" key, otherwise fallback to the first model in the array
    const defaultModelForProvider = activeProvider?.keys?.[0]?.default || activeProvider?.keys?.[0]?.models?.[0];
    
    this.model = modelOverride || (providerOverride ? defaultModelForProvider : (config.agents?.defaults?.model || defaultModelForProvider));
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

    const officialProviders = ["mistral", "openai"];
    if (!officialProviders.includes(this.activeProviderName)) {
      params.extra_body = {
        chat_template_kwargs: { enable_thinking: this.thinking }
      };
    }

    if (!onToken) {
      try {
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
      } catch (e) {
        const msg = e.message ? e.message.toLowerCase() : "";
        if (tools.length > 0 && (e.status === 404 || e.status === 400 || msg.includes("tool"))) {
          return this._chatOpenAI(messages, [], onToken);
        }
        throw e;
      }
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
      const msg = e.message ? e.message.toLowerCase() : "";
      if (tools.length > 0 && (e.status === 404 || e.status === 400 || msg.includes("tool"))) {
        return this._chatOpenAI(messages, [], onToken);
      }
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
        if (msg.gemini_parts) {
          contents.push({ role: "model", parts: msg.gemini_parts });
        } else if (msg.tool_calls?.length > 0) {
          const parts = [];
          if (msg.content) parts.push({ text: msg.content });
          parts.push(...msg.tool_calls.map(tc => {
            const funcCall = {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments)
            };
            const part = { functionCall: funcCall };
            if (tc.function.thought_signature) {
              part.thoughtSignature = tc.function.thought_signature;
            }
            return part;
          }));
          contents.push({ role: "model", parts });
        } else {
          contents.push({
            role: "model",
            parts: [{ text: msg.content || "" }]
          });
        }
      } else if (msg.role === "tool") {
        const part = {
          functionResponse: {
            name: msg.name,
            response: { name: msg.name, content: msg.content }
          }
        };
        const lastContent = contents[contents.length - 1];
        if (lastContent && lastContent.role === "user" && lastContent.parts[0]?.functionResponse) {
          lastContent.parts.push(part);
        } else {
          contents.push({ role: "user", parts: [part] });
        }
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

    const manualParts = [];
    if (onToken) {
      try {
        const result = await modelInstance.generateContentStream({ contents });
        for await (const chunk of result.stream) {
          if (chunk.candidates?.[0]?.content?.parts) {
            manualParts.push(...chunk.candidates[0].content.parts);
          }
          try {
            const chunkText = chunk.text();
            if (chunkText) {
              fullContent += chunkText;
              onToken(chunkText);
            }
          } catch (e) {}
        }
        response = await result.response;
        // Fix for SDK bug: manually aggregated parts preserve thoughtSignature
        if (response.candidates?.[0]?.content) {
          response.candidates[0].content.parts = manualParts;
        }
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
      const funcDef = {
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args)
      };
      if (p.thoughtSignature) funcDef.thought_signature = p.thoughtSignature;
      if (p.thought_signature) funcDef.thought_signature = p.thought_signature;
      if (p.functionCall.thought_signature) funcDef.thought_signature = p.functionCall.thought_signature;
      if (p.functionCall.thoughtSignature) funcDef.thought_signature = p.functionCall.thoughtSignature;

      parsedToolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "function",
        function: funcDef
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
        tool_calls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
        gemini_parts: response?.candidates?.[0]?.content?.parts
      },
      usage: { promptTokens, completionTokens }
    };
  }
}

export default ProviderRouter;
