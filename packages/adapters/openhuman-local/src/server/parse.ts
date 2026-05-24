import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

export interface ParsedOpenHumanResult {
  sessionId: string | null;
  summary: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  errorMessage: string | null;
}

const RESULT_MARKER = "openhuman_result";

/**
 * openhuman-core `run-turn --json` emits a single machine-readable JSON object
 * (marker `type: "openhuman_result"`) after any human-readable progress logs.
 * Scan stdout for the last such object so leading log noise is tolerated.
 */
export function parseOpenHumanResult(stdout: string): ParsedOpenHumanResult {
  let result: ParsedOpenHumanResult = {
    sessionId: null,
    summary: "",
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    errorMessage: null,
  };
  let found = false;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line[0] !== "{") continue;
    const event = parseJson(line);
    if (!event) continue;
    if (asString(event.type, "").trim() !== RESULT_MARKER) continue;

    const usage = parseObject(event.usage);
    result = {
      sessionId: asString(event.sessionId, "").trim() || null,
      summary: asString(event.summary, asString(event.finalText, "")).trim(),
      model: asString(event.model, "").trim() || null,
      inputTokens: asNumber(usage.inputTokens, 0),
      outputTokens: asNumber(usage.outputTokens, 0),
      cachedInputTokens: asNumber(usage.cachedInputTokens, 0),
      errorMessage: asString(event.error, "").trim() || null,
    };
    found = true;
  }

  if (!found) {
    result.errorMessage = "OpenHuman did not emit a result object";
  }
  return result;
}

export function isOpenHumanTransientError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`;
  return /rate.?limit|overloaded|429|503|temporarily unavailable|timeout|connection reset|upstream error/i.test(
    haystack,
  );
}
