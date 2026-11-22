/**
 * Validator rule for the copy-in Codex hook template (`examples/codex`).
 *
 * The template is the primary delivery path for Codex guard hooks, and a broken
 * one fails silently (a hook that points at nothing never fires, and a launcher
 * that cannot be found fails open). So `hooks.json` must be valid JSON in the
 * documented shape, every command must go through the launcher and name a
 * wrapper that exists in the plugin, and the launcher must be shipped beside it.
 *
 * Keys come from the documentation-derived reference
 * `plugins/team-skills/references/agent-tool-contracts.md`: best effort, not
 * verified by the maintainer. A repo with no `examples/codex` is not an error.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LAUNCHER = "team-skills-hook.sh";

/** Documented Codex hook events (agent-tool-contracts.md). */
const EVENTS = new Set([
  "SessionStart", "SessionEnd", "PreToolUse", "PermissionRequest", "PostToolUse", "PreCompact",
  "PostCompact", "UserPromptSubmit", "PreModelRequest", "PostModelRequest", "SubagentStart",
  "SubagentStop", "Stop", "Interrupt",
]);
/** Events whose entries select a tool and so need a matcher. */
const NEEDS_MATCHER = new Set(["PreToolUse", "PermissionRequest", "PostToolUse"]);

/** Where each wrapper may be wired: event, and (for tool events) what the matcher must cover. */
const WIRING = {
  "codex-guard-git.mjs": { event: "PreToolUse", covers: ["Bash"], say: "a Bash matcher under PreToolUse" },
  "codex-guard-quality.mjs": {
    event: "PreToolUse",
    covers: ["apply_patch", "Edit", "Write"],
    say: "an apply_patch/Edit/Write matcher under PreToolUse",
  },
  "codex-session-context.mjs": { event: "SessionStart", say: "the SessionStart event" },
};

const matcherParts = (matcher) => String(matcher ?? "").split("|").map((m) => m.trim()).filter(Boolean);

export function validateCodexTemplate(root, err) {
  const dir = join(root, "examples", "codex");
  const hooksPath = join(dir, "hooks.json");
  if (!existsSync(hooksPath)) return;

  const label = "examples/codex/hooks.json";
  let config;
  try {
    config = JSON.parse(readFileSync(hooksPath, "utf8"));
  } catch (e) {
    err(`${label}: cannot parse JSON: ${e.message}`);
    return;
  }

  if (!existsSync(join(dir, LAUNCHER))) err(`examples/codex: launcher ${LAUNCHER} is missing`);

  if (!config?.hooks || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
    err(`${label}: missing top-level \`hooks\` object`);
    return;
  }

  for (const [event, groups] of Object.entries(config.hooks)) {
    if (!EVENTS.has(event)) {
      err(`${label}: unknown event \`${event}\` (documented events: ${[...EVENTS].join(", ")})`);
    }
    if (!Array.isArray(groups)) {
      err(`${label}: \`hooks.${event}\` must be an array of groups`);
      continue;
    }
    for (const group of groups) {
      if (NEEDS_MATCHER.has(event) && matcherParts(group?.matcher).length === 0) {
        err(`${label}: a \`${event}\` group needs a non-empty \`matcher\``);
      }
      if (!Array.isArray(group?.hooks)) {
        err(`${label}: a \`${event}\` group is missing its \`hooks\` array`);
        continue;
      }
      for (const hook of group.hooks) {
        if (hook?.type !== "command") err(`${label}: a \`${event}\` hook needs \`"type": "command"\``);
        if (typeof hook?.timeout !== "number") err(`${label}: a \`${event}\` hook needs a numeric \`timeout\``);
        if (typeof hook?.command !== "string") {
          err(`${label}: a \`${event}\` hook needs a string \`command\``);
          continue;
        }
        if (!hook.command.includes(LAUNCHER)) {
          err(`${label}: command must go through the launcher ${LAUNCHER}: ${hook.command}`);
          continue;
        }
        const wrapper = /([\w-]+\.mjs)\b/.exec(hook.command)?.[1];
        if (!wrapper) {
          err(`${label}: command names no wrapper script: ${hook.command}`);
        } else if (!existsSync(join(root, "plugins", "team-skills", "hooks", wrapper))) {
          err(`${label}: wrapper ${wrapper} does not exist in plugins/team-skills/hooks`);
        }
        const rule = WIRING[wrapper];
        if (rule) {
          const parts = matcherParts(group.matcher);
          const wrongEvent = event !== rule.event;
          const wrongMatcher =
            rule.covers &&
            (parts.length === 0 || parts.some((p) => !rule.covers.includes(p)));
          if (wrongEvent || wrongMatcher) {
            err(`${label}: ${wrapper} must be wired to ${rule.say}, found \`${event}\` with matcher \`${group.matcher ?? ""}\``);
          }
        }
      }
    }
  }
}
