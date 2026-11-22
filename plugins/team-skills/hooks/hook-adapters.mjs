/**
 * Pure adapters that let the existing guard rules run under Cursor and Codex.
 *
 * No I/O in this module: no stdin, no process.exit, no files. A wrapper (the
 * Cursor and Codex hook tickets) reads stdin, calls `guardPayload`, writes
 * `result.stderr`, and exits with `result.exitCode`:
 *
 *   const r = guardPayload("cursor", readFileSync(0, "utf8"), {
 *     policy: ({ cwd, sessionId }) => buildPolicyDeps({ cwd, env: process.env, sessionId }),
 *   });
 *   if (r.exitCode === 2) rememberContextRaised(r);   // from policy-deps.mjs
 *   process.stderr.write(r.stderr);
 *   process.exit(r.exitCode);
 *
 * Public interface
 *   adaptPayload(tool, raw) -> one of
 *     { kind: "shell", command, cwd, sessionId }
 *     { kind: "edit", edits: [{ filePath, added, removed }], cwd, sessionId }
 *     { kind: "ignore" }                 known event, a tool the guard does not cover
 *     { kind: "unrecognised", reason }   unparseable or unknown; the caller fails open
 *   guardPayload(tool, raw, { policy }) -> { exitCode, stderr, sessionId?, reason?, findings? }
 *     adapts, then runs the real `evaluateCommand` (shell) or `findViolations`
 *     (edits). Blocks carry `sessionId` and `reason`; edit blocks add `findings`.
 *   allowResult(), blockResult(reason), failOpenResult(why)   result helpers.
 *
 *   `tool` is "cursor" or "codex". `raw` is the stdin text or a parsed object.
 *
 * REQUIRED policy dependencies. `options.policy` is the `deps` object for
 * `evaluateCommand` (see policy.mjs), or a function `(normalized) => deps`. Use
 * `buildPolicyDeps` from policy-deps.mjs: allowlist, autonomous flag, trailer
 * names, getCurrentBranch, getPrBase, getMerger, getPrAuthor (gh),
 * contextAlreadyRaised and getContextFreshness. Without it the guard would look
 * active while enforcing less than the Claude hook, so a missing `policy` fails
 * open with a loud "guard inactive: no policy dependencies supplied" warning.
 *
 * Failure contract: a violation blocks with exit 2 and the reason on stderr. A
 * payload that cannot be understood exits 0 with a warning that the guard is
 * inactive and why. There is no fail-closed mode.
 *
 * Payload fields come from the documentation-derived reference
 * `references/agent-tool-contracts.md`, not from recorded real payloads. These
 * are unconfirmed and read leniently, best effort: Cursor `preToolUse` edit
 * tool names (Write, Edit, StrReplace, MultiEdit, NotebookEdit, ApplyPatch,
 * case-insensitive; all other tools such as Read, Grep, Task, MCP and Delete
 * are ignored), and the field names inside edit tool inputs. When no file path
 * and text can be found the payload is "unrecognised": warn and allow.
 *
 * WRAPPERS MUST APPLY THE ESCALATION LADDER for quality findings, the way
 * guard-quality.mjs does (escalation.mjs: block, insist, then concede on the
 * record). `guardPayload` blocks on every finding and does not implement it,
 * because it needs per-session state. Without it a legitimate exception can
 * never be justified and a blocked retry loops forever.
 */

import { evaluateCommand } from "./policy.mjs";
import { findViolations } from "./quality.mjs";

const PREFIX = "[team-skills guard]";

export const allowResult = () => ({ exitCode: 0, stderr: "" });

export const blockResult = (reason) => ({ exitCode: 2, stderr: `${PREFIX} BLOCKED: ${reason}\n` });

export const failOpenResult = (why) => ({
  exitCode: 0,
  stderr: `${PREFIX} WARNING: guard inactive: ${why}. This call is allowed unchecked.\n`,
});

const unrecognised = (reason) => ({ kind: "unrecognised", reason });
const IGNORE = { kind: "ignore" };

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const firstString = (obj, keys) => keys.map((k) => obj?.[k]).find((v) => typeof v === "string");

/**
 * Pull the file path and every text field out of a Write/Edit/MultiEdit/notebook
 * style tool_input, mirroring what guard-quality.mjs reads for Claude. ALL
 * present fields are judged, so a clean field cannot launder a dirty one.
 */
function editFromToolInput(input) {
  const filePath = firstString(input, ["file_path", "notebook_path", "path", "filePath"]);
  const items = Array.isArray(input.edits) ? input.edits.filter(isObject) : [];
  const addedParts = [
    ...["content", "contents", "text", "new_string", "new_source"].map((k) => input[k]),
    ...items.map((item) => item.new_string),
  ].filter((v) => typeof v === "string");
  const removedParts = [input.old_string, ...items.map((item) => item.old_string)].filter(
    (v) => typeof v === "string",
  );
  if (!filePath || addedParts.length === 0) return null;
  return { filePath, added: addedParts.join("\n"), removed: removedParts.join("\n") };
}

/**
 * Parse an apply_patch body into one edit per file. Added lines start with `+`,
 * removed with `-`; context lines and hunk headers are ignored. A `*** Move to:`
 * line makes the NEW path the edit's path, so content is judged as that file.
 * Only line endings are trimmed from paths, never meaningful characters.
 */
function editsFromPatch(patch) {
  const edits = [];
  let current = null;
  for (const raw of patch.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const header = /^\*\*\* (?:Add|Update|Delete) File: (.*)$/.exec(line);
    const move = /^\*\*\* Move to: (.*)$/.exec(line);
    if (header) {
      current = { filePath: header[1], added: [], removed: [] };
      edits.push(current);
    } else if (move && current) {
      current.filePath = move[1];
    } else if (current && line.startsWith("+")) {
      current.added.push(line.slice(1));
    } else if (current && line.startsWith("-")) {
      current.removed.push(line.slice(1));
    }
  }
  return edits.map((e) => ({ filePath: e.filePath, added: e.added.join("\n"), removed: e.removed.join("\n") }));
}

const patchText = (input) => firstString(input, ["command", "patch", "input", "diff"]) ?? null;
const PATCH_HEADER = /^\*\*\* (Add|Update|Delete) File:/m;

/** Edits from patch text when the tool carries a patch, else from field shapes. */
function editsFromInput(input) {
  const patch = patchText(input);
  if (patch !== null && PATCH_HEADER.test(patch)) return editsFromPatch(patch);
  const e = editFromToolInput(input);
  return e ? [e] : null;
}

function shellFrom(command, payload, sessionId) {
  if (typeof command !== "string") return unrecognised("no command string in the payload");
  return { kind: "shell", command, cwd: payload.cwd, sessionId };
}

function editFrom(edits, payload, sessionId, what) {
  if (!edits || edits.length === 0) {
    return unrecognised(`${what} carried no file path and text the guard can read`);
  }
  return { kind: "edit", edits, cwd: payload.cwd, sessionId };
}

/** Cursor preToolUse tool names treated as file edits. Documentation-derived, unconfirmed. */
const CURSOR_EDIT_TOOLS = /^(Write|Edit|StrReplace|MultiEdit|NotebookEdit|ApplyPatch)$/i;

function adaptCursor(payload) {
  const sessionId = payload.conversation_id;
  switch (payload.hook_event_name) {
    case "beforeShellExecution":
      return shellFrom(payload.command, payload, sessionId);
    case "preToolUse": {
      const input = isObject(payload.tool_input) ? payload.tool_input : {};
      if (payload.tool_name === "Shell") return shellFrom(input.command, payload, sessionId);
      if (CURSOR_EDIT_TOOLS.test(String(payload.tool_name))) {
        return editFrom(editsFromInput(input), payload, sessionId, `Cursor ${payload.tool_name}`);
      }
      return IGNORE;
    }
    default:
      return unrecognised(`unknown Cursor event "${payload.hook_event_name}"`);
  }
}

function adaptCodex(payload) {
  const sessionId = payload.session_id;
  if (payload.hook_event_name !== "PreToolUse") {
    return unrecognised(`unknown Codex event "${payload.hook_event_name}"`);
  }
  const input = isObject(payload.tool_input) ? payload.tool_input : {};
  switch (payload.tool_name) {
    case "Bash":
      return shellFrom(input.command, payload, sessionId);
    case "apply_patch":
      if (patchText(input) === null) {
        return unrecognised("apply_patch carried no patch text in tool_input.command");
      }
      return editFrom(editsFromPatch(patchText(input)), payload, sessionId, "apply_patch");
    case "Edit":
    case "Write":
    case "MultiEdit":
    case "NotebookEdit":
      return editFrom(editsFromInput(input), payload, sessionId, `Codex ${payload.tool_name}`);
    default:
      return IGNORE;
  }
}

/**
 * @param {"cursor"|"codex"} tool
 * @param {string|object} raw  stdin text or parsed payload
 */
export function adaptPayload(tool, raw) {
  let payload = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      return unrecognised("payload is not valid JSON");
    }
  }
  if (!isObject(payload)) return unrecognised("payload is not a JSON object");
  if (tool === "cursor") return adaptCursor(payload);
  if (tool === "codex") return adaptCodex(payload);
  return unrecognised(`no adapter for tool "${tool}"`);
}

/**
 * Adapt, judge with the real rule modules, and return what the wrapper should do.
 * @param {"cursor"|"codex"} tool
 * @param {string|object} raw
 * @param {{ policy: object | ((normalized: object) => object) }} options
 *        `policy` is evaluateCommand's deps (build with `buildPolicyDeps`).
 * @returns {{ exitCode: 0|2, stderr: string, sessionId?: string, reason?: string, findings?: object[] }}
 */
export function guardPayload(tool, raw, options = {}) {
  const n = adaptPayload(tool, raw);
  if (n.kind === "unrecognised") return failOpenResult(n.reason);
  if (n.kind === "ignore") return allowResult();

  // Required, not defaulted: running the policy with no resolvers looks active
  // while enforcing less than the Claude hook (no branch, no gh, no allowlist).
  const supplied = typeof options?.policy === "function" ? options.policy(n) : options?.policy;
  if (!isObject(supplied)) return failOpenResult("no policy dependencies supplied");

  if (n.kind === "shell") {
    const verdict = evaluateCommand(n.command, supplied);
    return verdict.action === "block"
      ? { ...blockResult(verdict.reason), sessionId: n.sessionId, reason: verdict.reason }
      : allowResult();
  }

  const findings = n.edits.flatMap((edit) =>
    findViolations(edit).map((finding) => ({ ...finding, filePath: edit.filePath })),
  );
  if (findings.length === 0) return allowResult();
  const reason = findings
    .map((f) => `${f.filePath}${f.line ? `:${f.line}` : ""} [${f.ruleId}] ${f.why}`)
    .join("\n");
  return { ...blockResult(reason), sessionId: n.sessionId, reason, findings };
}
