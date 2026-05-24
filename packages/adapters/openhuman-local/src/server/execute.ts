import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  ensureAdapterExecutionTargetCommandResolvable,
  resolveAdapterExecutionTargetCommandForLogs,
  resolveAdapterExecutionTargetTimeoutSec,
  runAdapterExecutionTargetProcess,
} from "@paperclipai/adapter-utils/execution-target";
import {
  asNumber,
  asString,
  asStringArray,
  buildInvocationEnvForLogs,
  buildPaperclipEnv,
  ensureAbsoluteDirectory,
  ensurePathInEnv,
  joinPromptSections,
  parseObject,
  readPaperclipIssueWorkModeFromContext,
  renderPaperclipWakePrompt,
  renderTemplate,
  stringifyPaperclipWakePayload,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_OPENHUMAN_MODEL } from "../index.js";
import { isOpenHumanTransientError, parseOpenHumanResult } from "./parse.js";

const DEFAULT_AGENT_ARCHETYPE = "orchestrator";

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function renderApiAccessNote(env: Record<string, string>): string {
  if (!hasNonEmptyEnvValue(env, "PAPERCLIP_API_URL") || !hasNonEmptyEnvValue(env, "PAPERCLIP_API_KEY")) {
    return "";
  }
  return [
    "Paperclip API access note:",
    "Use the `paperclip` skill and HTTP requests to the Paperclip API to coordinate.",
    "Include X-Paperclip-Run-Id on mutating requests.",
    "",
    "",
  ].join("\n");
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const command = asString(config.command, "openhuman-core");
  const model = asString(config.model, DEFAULT_OPENHUMAN_MODEL).trim();
  const agentArchetype = asString(config.agentId, DEFAULT_AGENT_ARCHETYPE).trim() || DEFAULT_AGENT_ARCHETYPE;
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE);

  const configuredCwd = asString(config.cwd, "");
  const cwd = configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  // Build the PAPERCLIP_* environment the heartbeat procedure relies on.
  const envConfig = parseObject(config.env);
  const hasExplicitApiKey =
    typeof envConfig.PAPERCLIP_API_KEY === "string" && envConfig.PAPERCLIP_API_KEY.trim().length > 0;
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  env.PAPERCLIP_RUN_ID = runId;

  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const wakePayloadJson = stringifyPaperclipWakePayload(context.paperclipWake);
  const issueWorkMode = readPaperclipIssueWorkModeFromContext(context);

  if (wakeTaskId) env.PAPERCLIP_TASK_ID = wakeTaskId;
  if (issueWorkMode) env.PAPERCLIP_ISSUE_WORK_MODE = issueWorkMode;
  if (wakeReason) env.PAPERCLIP_WAKE_REASON = wakeReason;
  if (wakeCommentId) env.PAPERCLIP_WAKE_COMMENT_ID = wakeCommentId;
  if (approvalId) env.PAPERCLIP_APPROVAL_ID = approvalId;
  if (approvalStatus) env.PAPERCLIP_APPROVAL_STATUS = approvalStatus;
  if (linkedIssueIds.length > 0) env.PAPERCLIP_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  if (wakePayloadJson) env.PAPERCLIP_WAKE_PAYLOAD_JSON = wakePayloadJson;

  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  if (!hasExplicitApiKey && authToken) {
    env.PAPERCLIP_API_KEY = authToken;
  }

  const effectiveEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const runtimeEnv = ensurePathInEnv(effectiveEnv);

  const timeoutSec = resolveAdapterExecutionTargetTimeoutSec(null, asNumber(config.timeoutSec, 0));
  const graceSec = asNumber(config.graceSec, 20);

  await ensureAdapterExecutionTargetCommandResolvable(command, null, cwd, runtimeEnv, {
    installCommand: ctx.runtimeCommandSpec?.installCommand ?? null,
    timeoutSec,
  });
  const resolvedCommand = await resolveAdapterExecutionTargetCommandForLogs(command, null, cwd, runtimeEnv);

  // Compose the heartbeat prompt: wake delta first, then the execution contract.
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, { resumedSession: false });
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const apiAccessNote = renderApiAccessNote(env);
  const prompt = joinPromptSections([wakePrompt, apiAccessNote, renderedPrompt]);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");

  const args = ["run-turn", "--json", "--agent", agentArchetype];
  if (model && model !== DEFAULT_OPENHUMAN_MODEL) args.push("--model", model);
  if (runtimeSessionId) args.push("--session", runtimeSessionId);
  const extraArgs = asStringArray(config.extraArgs);
  if (extraArgs.length > 0) args.push(...extraArgs);

  const loggedEnv = buildInvocationEnvForLogs(env, {
    runtimeEnv,
    includeRuntimeKeys: ["HOME"],
    resolvedCommand,
  });
  if (onMeta) {
    await onMeta({
      adapterType: "openhuman_local",
      command: resolvedCommand,
      cwd,
      commandNotes: ["Prompt is passed to openhuman-core run-turn on stdin."],
      commandArgs: args,
      env: loggedEnv,
      prompt,
      promptMetrics: { promptChars: prompt.length, wakePromptChars: wakePrompt.length },
      context,
    });
  }

  const proc = await runAdapterExecutionTargetProcess(runId, null, command, args, {
    cwd,
    env,
    stdin: prompt,
    timeoutSec,
    graceSec,
    onSpawn,
    onLog,
  });

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  const parsed = parseOpenHumanResult(proc.stdout);
  const failed = (proc.exitCode ?? 0) !== 0 || Boolean(parsed.errorMessage);
  const transient = failed && isOpenHumanTransientError(proc.stdout, proc.stderr);
  const resolvedSessionId = parsed.sessionId ?? (runtimeSessionId || null);
  const resolvedModel = parsed.model ?? (model && model !== DEFAULT_OPENHUMAN_MODEL ? model : null);

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: failed
      ? parsed.errorMessage ?? `openhuman-core exited with code ${proc.exitCode ?? -1}`
      : null,
    errorFamily: transient ? "transient_upstream" : null,
    usage: {
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      cachedInputTokens: parsed.cachedInputTokens,
    },
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionId
      ? { sessionId: resolvedSessionId, cwd: path.resolve(cwd) }
      : null,
    sessionDisplayId: resolvedSessionId,
    provider: "openhuman",
    biller: "openhuman",
    model: resolvedModel,
    costUsd: null,
    summary: parsed.summary,
    resultJson: failed ? { stderr: proc.stderr } : null,
  };
}
