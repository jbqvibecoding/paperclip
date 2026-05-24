export const type = "openhuman_local";
export const label = "OpenHuman (local)";

// OpenHuman resolves the concrete inference model from its own configuration
// (provider + credentials). The adapter only forwards an optional override.
export const DEFAULT_OPENHUMAN_MODEL = "inherit";

export const models = [
  { id: DEFAULT_OPENHUMAN_MODEL, label: "OpenHuman default (inherit)" },
];

export const agentConfigurationDoc = `# openhuman_local agent configuration

Adapter: openhuman_local

Runs an OpenHuman agent harness locally on the Paperclip host to execute a
company task. OpenHuman's orchestrator archetype, tools, memory tree and
sub-agent delegation power the work; Paperclip provides the company, task
board, governance and budgets.

Use when:
- You want a Paperclip company agent backed by the full OpenHuman harness
- You want OpenHuman's tools/memory/sub-agents available during heartbeats

Don't use when:
- OpenHuman core (\`openhuman-core\`) is not installed on the Paperclip host
- You only need a one-shot script without an agent loop (use process)

Core fields:
- command (string, optional): openhuman-core binary. Defaults to "openhuman-core".
- cwd (string, optional): absolute working directory for the run (created if missing).
- model (string, optional): inference model override. Defaults to OpenHuman's own config.
- agentId (string, optional): OpenHuman agent archetype id. Defaults to "orchestrator".
- extraArgs (string[], optional): additional CLI args passed to \`run-turn\`.
- env (object, optional): KEY=VALUE environment variables.

Operational fields:
- timeoutSec (number, optional): run timeout in seconds.
- graceSec (number, optional): SIGTERM grace period in seconds (default 20).

Notes:
- The adapter invokes \`openhuman-core run-turn --json\` and passes the heartbeat
  prompt on stdin.
- Paperclip injects the PAPERCLIP_* environment (including a short-lived
  PAPERCLIP_API_KEY run JWT) so the agent can call the Paperclip API and follow
  the heartbeat procedure from the \`paperclip\` skill.
`;
