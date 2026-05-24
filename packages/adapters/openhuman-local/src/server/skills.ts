import type { AdapterSkillContext, AdapterSkillSnapshot } from "@paperclipai/adapter-utils";

// OpenHuman manages its own skills catalog internally (src/openhuman/skills),
// including the `paperclip` heartbeat skill installed on the OpenHuman side.
// Paperclip therefore does not stage runtime skills into a workspace for this
// adapter — report the skill surface as unsupported.
function emptySnapshot(): AdapterSkillSnapshot {
  return {
    adapterType: "openhuman_local",
    supported: false,
    mode: "unsupported",
    desiredSkills: [],
    entries: [],
    warnings: [],
  };
}

export async function listOpenHumanSkills(_ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return emptySnapshot();
}

export async function syncOpenHumanSkills(
  _ctx: AdapterSkillContext,
  _desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  return emptySnapshot();
}
