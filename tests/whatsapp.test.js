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

test("WhatsApp Formatting: inline links formatting", () => {
  const input = "Please visit [vatican.va](https://vatican.va) and check out [Wikipedia: Dog](https://wikipedia.org/wiki/Dog_(disambiguation)).";
  // vatican.va is redundant with https://vatican.va, so it simplifies to the URL.
  // Wikipedia: Dog is a description, so it formats as Description (URL).
  const expected = "Please visit https://vatican.va and check out Wikipedia: Dog (https://wikipedia.org/wiki/Dog_(disambiguation)).";
  assert.strictEqual(formatWhatsAppMarkdown(input), expected);
});

test("WhatsApp Formatting: table with links extraction", () => {
  const input = `| Name | Link |
| --- | --- |
| Vatican | [vatican.va](https://vatican.va) |`;

  const expectedTablePart = "┌─────────┬────────────┐\n" +
    "│ Name    │ Link       │\n" +
    "├─────────┼────────────┤\n" +
    "│ Vatican │ vatican.va │\n" +
    "└─────────┴────────────┘";

  const expectedSourcePart = "*Links & Sources:*\n• *vatican.va*: https://vatican.va";

  const result = formatWhatsAppMarkdown(input);
  assert.ok(result.includes(expectedTablePart), `Expected table part to be formatted, got:\n${result}`);
  assert.ok(result.includes(expectedSourcePart), `Expected sources part to be listed, got:\n${result}`);
});

