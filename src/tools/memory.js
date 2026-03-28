export default [
  {
    schema: {
      name: "search_memory",
      description: "Search past conversation history for keywords to retrieve context.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
    },
    execute: async ({ query }, { memory }) => await memory.searchPastEvents(query)
  },
  {
    schema: {
      name: "add_memory",
      description: "Store a long-term memory about the user or project. Categories: fact (verified info), preference (tastes/likes), rule (behavioral directives from user), summary (conversation/context summaries).",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The memory to store" },
          category: { type: "string", enum: ["fact", "preference", "rule", "summary"], description: "Memory category" }
        },
        required: ["content", "category"]
      }
    },
    execute: async ({ content, category }, { memory, userId }) => await memory.addCoreMemory(userId, content, category)
  },
  {
    schema: {
      name: "remove_memory",
      description: "Remove a long-term memory by ID.",
      parameters: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] }
    },
    execute: async ({ id }, { memory, userId }) => await memory.removeCoreMemory(userId, id)
  }
];
