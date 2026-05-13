import test from "node:test";
import assert from "node:assert";
import { setDebug, logger } from "../src/utils/index.js";

test("Utils: logger.debug respects debug state", () => {
  const originalConsoleDebug = console.debug;
  let debugCalledCount = 0;
  let lastDebugArgs = null;

  console.debug = (...args) => {
    debugCalledCount++;
    lastDebugArgs = args;
  };

  try {
    // Initial state might be false, but let's explicitly set it
    setDebug(false);
    logger.debug("test false");
    assert.strictEqual(debugCalledCount, 0, "console.debug should not be called when debug is false");

    setDebug(true);
    logger.debug("test true", 123);
    assert.strictEqual(debugCalledCount, 1, "console.debug should be called when debug is true");
    assert.ok(lastDebugArgs[0].includes("[DEBUG]"), "Debug message should include [DEBUG] prefix");
    assert.strictEqual(lastDebugArgs[1], "test true");
    assert.strictEqual(lastDebugArgs[2], 123);

    // Testing setDebug falsy values
    setDebug(0);
    logger.debug("test falsy");
    assert.strictEqual(debugCalledCount, 1, "console.debug should not be called when debug is set to 0");

    setDebug(null);
    logger.debug("test null");
    assert.strictEqual(debugCalledCount, 1, "console.debug should not be called when debug is set to null");

  } finally {
    console.debug = originalConsoleDebug;
    // We can't perfectly reset the state without isDebug, but we can turn it off
    // to avoid affecting other tests if they run sequentially.
    setDebug(false);
  }
});
