export default [
  {
    schema: {
      name: "web_search",
      description: "Search the web using Brave Search. Returns titles, URLs, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          count: { type: "integer", description: "Number of results (1-10, default 5)" }
        },
        required: ["query"]
      }
    },
    execute: async ({ query, count = 5 }, { config }) => {
      const braveApiKey = config.tools?.web?.search?.apiKey || "";
      if (!braveApiKey) return { error: "Brave Search API key not configured." };
      try {
        const n = Math.min(Math.max(count, 1), 10);
        const params = new URLSearchParams({ q: query, count: n });
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
          headers: { Accept: "application/json", "X-Subscription-Token": braveApiKey }
        });
        if (!res.ok) return { error: `Brave API error: ${res.status} ${res.statusText}` };
        const data = await res.json();
        const results = data.web?.results || [];
        if (results.length === 0) return `No results for: ${query}`;
        const lines = [`Results for: ${query}\n`];
        results.slice(0, n).forEach((item, i) => {
          lines.push(`${i + 1}. ${item.title || ""}\n   ${item.url || ""}`);
          if (item.description) lines.push(`   ${item.description}`);
        });
        return lines.join("\n");
      } catch (e) { return { error: e.message }; }
    }
  },
  {
    schema: {
      name: "web_fetch",
      description: "Fetch a URL and extract readable text content (HTML → clean text).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          maxChars: { type: "integer", description: "Max characters to return (default: 50000)" }
        },
        required: ["url"]
      }
    },
    execute: async ({ url, maxChars = 50000 }) => {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return { error: "Only http/https URLs allowed." };
      } catch { return { error: `Invalid URL: ${url}` }; }
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36" },
          redirect: "follow"
        });
        if (!res.ok) return { error: `Fetch error: ${res.status} ${res.statusText}` };
        const contentType = res.headers.get("content-type") || "";
        let text;
        if (contentType.includes("application/json")) {
          text = JSON.stringify(await res.json(), null, 2);
        } else {
          const raw = await res.text();
          text = raw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        }
        const truncated = text.length > maxChars;
        if (truncated) text = text.substring(0, maxChars);
        return JSON.stringify({ url, finalUrl: res.url, status: res.status, truncated, length: text.length, text });
      } catch (e) { return { error: e.message }; }
    }
  }
];
