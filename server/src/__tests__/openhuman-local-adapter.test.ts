import { describe, expect, it } from "vitest";
import {
  isOpenHumanTransientError,
  parseOpenHumanResult,
} from "@paperclipai/adapter-openhuman-local/server";

describe("openhuman_local result parsing", () => {
  it("parses the openhuman_result line, tolerating leading log noise", () => {
    const stdout = [
      "[openhuman] starting turn",
      "thinking about the task...",
      JSON.stringify({
        type: "openhuman_result",
        sessionId: "sess-123",
        summary: "Marked the task done and posted a comment.",
        model: "claude-opus-4-7",
        usage: { inputTokens: 1200, outputTokens: 340, cachedInputTokens: 800 },
      }),
    ].join("\n");

    const parsed = parseOpenHumanResult(stdout);
    expect(parsed.sessionId).toBe("sess-123");
    expect(parsed.summary).toBe("Marked the task done and posted a comment.");
    expect(parsed.model).toBe("claude-opus-4-7");
    expect(parsed.inputTokens).toBe(1200);
    expect(parsed.outputTokens).toBe(340);
    expect(parsed.cachedInputTokens).toBe(800);
    expect(parsed.errorMessage).toBeNull();
  });

  it("uses the last result object when several are emitted", () => {
    const stdout = [
      JSON.stringify({ type: "openhuman_result", summary: "first", sessionId: "a" }),
      JSON.stringify({ type: "openhuman_result", summary: "final", sessionId: "b" }),
    ].join("\n");
    const parsed = parseOpenHumanResult(stdout);
    expect(parsed.summary).toBe("final");
    expect(parsed.sessionId).toBe("b");
  });

  it("surfaces an embedded error message", () => {
    const stdout = JSON.stringify({
      type: "openhuman_result",
      error: "inference provider returned 503",
    });
    const parsed = parseOpenHumanResult(stdout);
    expect(parsed.errorMessage).toBe("inference provider returned 503");
  });

  it("reports a missing result object", () => {
    expect(parseOpenHumanResult("no json here\n{not json}").errorMessage).toBe(
      "OpenHuman did not emit a result object",
    );
  });
});

describe("openhuman_local transient error detection", () => {
  it("flags rate limit / upstream failures as transient", () => {
    expect(isOpenHumanTransientError("", "Error: 429 rate limit exceeded")).toBe(true);
    expect(isOpenHumanTransientError("model overloaded", "")).toBe(true);
    expect(isOpenHumanTransientError("upstream error from provider", "")).toBe(true);
  });

  it("does not flag ordinary failures as transient", () => {
    expect(isOpenHumanTransientError("task failed: invalid argument", "")).toBe(false);
  });
});
