import test from "node:test";
import assert from "node:assert";
import sessionManager from "../src/session/index.js";

test("SessionManager: getSessionId returns consistent ID for same user", () => {
  const channel = "test-channel";
  const userId = "user-123";

  const id1 = sessionManager.getSessionId(channel, userId);
  const id2 = sessionManager.getSessionId(channel, userId);

  assert.ok(id1, "Session ID should be truthy");
  assert.strictEqual(id1, id2, "Subsequent calls for same user should return same ID");
});

test("SessionManager: getSessionId returns different IDs for different users", () => {
  const id1 = sessionManager.getSessionId("channel", "user-1");
  const id2 = sessionManager.getSessionId("channel", "user-2");
  const id3 = sessionManager.getSessionId("other-channel", "user-1");

  assert.notStrictEqual(id1, id2);
  assert.notStrictEqual(id1, id3);
  assert.notStrictEqual(id2, id3);
});

test("SessionManager: clearSession removes the session", () => {
  const channel = "test-clear";
  const userId = "user-456";

  const id1 = sessionManager.getSessionId(channel, userId);
  sessionManager.clearSession(channel, userId);
  const id2 = sessionManager.getSessionId(channel, userId);

  assert.notStrictEqual(id1, id2, "Session ID should change after clearing");
});

test("SessionManager: session ID format (secure UUID)", () => {
  const id = sessionManager.getSessionId("format", "test");
  // UUID v4 format
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
