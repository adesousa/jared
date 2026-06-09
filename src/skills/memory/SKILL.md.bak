---
name: memory
description: Two-layer memory system with grep-based recall.
---

# Memory

## Structure

- **Core Memory** — Long-term memories. Always loaded into your context via `add_memory`. Organized in 4 categories:
  - `fact`: Verified factual information ("User lives in Paris", "Project uses Bun").
  - `preference`: Tastes and personal preferences ("Prefers dark mode", "Likes black coffee").
  - `rule`: Behavioral directives or instructions ("Always reply in French", "Never delete files without asking").
  - `summary`: Context or conversation summaries ("Project X summary: migrating from React to Vue").
- **Conversation History** — Stored in SQLite. NOT loaded into context by default. Search it with `search_memory`.

## Search Past Events

Use the native `search_memory` tool:

```
search_memory(query="keyword")
```

Combine patterns for broader searches.

## When to Update Core Memory

Use `add_memory` immediately for:

- User preferences ("I prefer dark mode") -> `category: "preference"`
- Project context ("The API uses OAuth2") -> `category: "fact"`
- Relationships ("Alice is the project lead") -> `category: "fact"`
- Instructions ("Always use absolute paths") -> `category: "rule"`
- Past project overviews -> `category: "summary"`

Use `remove_memory` to delete outdated or replaced memories by their ID.

## Tips

- Always search memory before claiming you don't know something.
- Proactively save important details the user mentions in passing.
- Keep memories concise and atomic — one fact/rule per entry.
