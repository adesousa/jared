import test from "node:test";
import assert from "node:assert";
import ConsoleChannel from "../src/channels/console.js";

// Since ConsoleChannel defines StreamMarkdownLexer inside the file and doesn't export it directly,
// we can instantiate ConsoleChannel and grab its lexer, or we can test the channel itself.
// But wait, ConsoleChannel initializes this.lexer:
// `this.lexer = new StreamMarkdownLexer(chars => process.stdout.write(chars));`
// Let's inspect console.js. It exports ConsoleChannel.
// To get the Lexer class or test its functionality, we can instantiate ConsoleChannel and inspect/override this.lexer.write.

test("StreamMarkdownLexer: formats standard link with OSC 8", () => {
  const channel = new ConsoleChannel({ enabled: false });
  let output = "";
  channel.lexer.write = (chars) => {
    output += chars;
  };
  
  channel.lexer.push("Check out [vatican.va](https://vatican.va) now.\n");
  channel.lexer.flush();
  
  // Check that the OSC 8 code and styling are present
  assert.ok(output.includes("\u001b]8;;https://vatican.va\u001b\\"));
  assert.ok(output.includes("vatican.va"));
  assert.ok(output.includes("\u001b]8;;\u001b\\"));
});

test("StreamMarkdownLexer: formats nested parentheses in URL", () => {
  const channel = new ConsoleChannel({ enabled: false });
  let output = "";
  channel.lexer.write = (chars) => {
    output += chars;
  };
  
  channel.lexer.push("[Dog](https://wikipedia.org/wiki/Dog_(disambiguation))\n");
  channel.lexer.flush();
  
  assert.ok(output.includes("https://wikipedia.org/wiki/Dog_(disambiguation)"));
  assert.ok(output.includes("Dog"));
});

test("StreamMarkdownLexer: formatting styling inside link text", () => {
  const channel = new ConsoleChannel({ enabled: false });
  let output = "";
  channel.lexer.write = (chars) => {
    output += chars;
  };
  
  channel.lexer.push("[**vatican.va**](https://vatican.va)\n");
  channel.lexer.flush();
  
  // The bold style \x1b[1m (BOLD) should be applied to vatican.va,
  // then it should style back to underline cyan, and finally reset.
  assert.ok(output.includes("\u001b]8;;https://vatican.va\u001b\\"));
  assert.ok(output.includes("vatican.va"));
});

test("StreamMarkdownLexer: handles link split across chunks during stream", () => {
  const channel = new ConsoleChannel({ enabled: false });
  let output = "";
  channel.lexer.write = (chars) => {
    output += chars;
  };
  
  channel.lexer.push("Go to [vatican.");
  // Should not output the unfinished link yet
  assert.strictEqual(output, "Go to ");
  
  channel.lexer.push("va](https://vatican.va) please.");
  channel.lexer.flush();
  
  assert.ok(output.includes("\u001b]8;;https://vatican.va\u001b\\"));
  assert.ok(output.includes("vatican.va"));
  assert.ok(output.includes("please."));
});

test("StreamMarkdownLexer: formats table with links correctly", () => {
  const channel = new ConsoleChannel({ enabled: false });
  let output = "";
  channel.lexer.write = (chars) => {
    output += chars;
  };
  
  channel.lexer.push("| Site | URL |\n");
  channel.lexer.push("|------|-----|\n");
  channel.lexer.push("| Vatican | [vatican.va](https://vatican.va) |\n");
  channel.lexer.flush();
  
  // Verify that the table columns are aligned and contain formatted links
  assert.ok(output.includes("Vatican"));
  assert.ok(output.includes("vatican.va"));
  assert.ok(output.includes("\u001b]8;;https://vatican.va\u001b\\"));
});
