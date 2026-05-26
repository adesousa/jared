import test from "node:test";
import assert from "node:assert";
import { formatWhatsAppMarkdown } from "../src/channels/whatsapp.js";

test("WhatsApp Formatting: headers translation", () => {
  const input = "# Hello World\n## Subheader\n### Sub-sub-header";
  const expected = "*■ Hello World*\n*■■ Subheader*\n*■■■ Sub-sub-header*";
  assert.strictEqual(formatWhatsAppMarkdown(input), expected);
});

test("WhatsApp Formatting: lists translation", () => {
  const input = "- Item 1\n* Item 2\n  - Nested";
  const expected = "• Item 1\n• Item 2\n  • Nested";
  assert.strictEqual(formatWhatsAppMarkdown(input), expected);
});

test("WhatsApp Formatting: bold and italic translation", () => {
  const input = "This is **bold** text and *italic* text.";
  const expected = "This is *bold* text and _italic_ text.";
  assert.strictEqual(formatWhatsAppMarkdown(input), expected);
});

test("WhatsApp Formatting: inline code translation", () => {
  const input = "Use the `exec` tool for commands.";
  const expected = "Use the ```exec``` tool for commands.";
  assert.strictEqual(formatWhatsAppMarkdown(input), expected);
});

test("WhatsApp Formatting: table translation", () => {
  const input = `Here is a table:

| Name | Role | Location |
| --- | --- | --- |
| Jared | COO | Silicon Valley |
| Richard | CEO | Palo Alto |`;

  const expectedTable = "```\n" +
    "┌─────────┬──────┬────────────────┐\n" +
    "│ Name    │ Role │ Location       │\n" +
    "├─────────┼──────┼────────────────┤\n" +
    "│ Jared   │ COO  │ Silicon Valley │\n" +
    "│ Richard │ CEO  │ Palo Alto      │\n" +
    "└─────────┴──────┴────────────────┘\n" +
    "```";

  const result = formatWhatsAppMarkdown(input);
  assert.ok(result.includes(expectedTable), `Expected result to include formatted table, got:\n${result}`);
});
