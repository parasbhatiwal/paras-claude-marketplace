/**
 * Pure adapters that let the existing guard rules run under Cursor and Codex.
 *
 * No I/O: no stdin, no process.exit, no files. A wrapper (the Cursor and Codex
 * hook tickets) reads stdin, calls `guardPayload`, writes `result.stderr`, and
 * exits with `result.exitCode`. That is the whole wrapper:
 *
 *   const r = guardPayload("cursor", readFileSync(0, "utf8"), { policy: { ...deps } });
 *   process.stderr.write(r.stderr);
 *   process.exit(r.exitCode);
 *
 * Public interface
 *   adaptPayload(tool, raw) -> one of
 *     { kind: "shell", command, cwd, sessionId }
 *     { kind: "edit", edits: [{ filePath, added, removed }], cwd, sessionId }
 *     { kind: "ignore" }                 known event, a tool the guard does not cover
 *     { kind: "unrecognised", reason }   unparseable or unknown; the caller fails open
 *   guardPayload(tool, raw, { policy }) -> { exitCode, stderr, findings? }
 *     adapts, then runs the real `evaluateCommand` (shell) or `findViolations`
 *     (edits). `policy` is passed through as evaluateCommand's `deps`.
 *   allowResult(), blockResult(reason), failOpenResult(why)   result helpers.
 *
 *   `tool` is "cursor" or "codex". `raw` is the stdin text or a parsed object.
 *
 * Failure contract: a violation blocks with exit 2 and the reason on stderr. A
 * payload that cannot be understood exits 0 with a warning that the guard is
 * inactive and why. There is no fail-closed mode.
 *
 * Payload fields come from the documentation-derived reference
 * `references/agent-tool-contracts.md`, not from recorded real payloads. Fields
 * that reference lists as unconfirmed (Cursor `Write`, Codex `apply_patch`
 * internals) are read leniently; when none of the candidates is present the
 * payload is "unrecognised" and the guard warns and allows.
 *
 * Not covered here: the quality guard's attempt ladder (escalation.mjs) is
 * per-session state and therefore I/O; `guardPayload` blocks on every finding.
 */

import { evaluateCommand } from "./policy.mjs";
import { findViolations } from "./quality.mjs";

const PREFIX = "[team-skills guard]";

export const allowResult = () => ({ exitCode: 0, stderr: "" });

export const blockResult = (reason) => ({ exitCode: 2, stderr: `${PREFIX} BLOCKED: ${reason}\n` });

export const failOpenResult = (why) => ({
  exitCode: 0,
  stderr: `${PREFIX} WARNING: guard inactive for this call, allowing it. Why: ${why}\n`,
});

const unrecognised = (reason) => ({ kind: "unrecognised", reason });
const IGNORE = { kind: "ignore" };

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const firstString = (obj, keys) => keys.map((k) => obj?.[k]).find((v) => typeof v === "string");

/** Pull the file path and text out of a Write/Edit style tool_input. */
function editFromToolInput(input) {
  const filePath = firstString(input, ["file_path", "path", "filePath"]);
  const added = firstString(input, ["content", "contents", "new_string", "text"]);
  const removed = firstString(input, ["old_string"]) ?? "";
  if (!filePath || added === undefined) return null;
  return { filePath, added, removed };
}

/**
 * Parse an apply_patch body into one edit per file. Added lines start with `+`,
 * removed with `-`; context lines and hunk headers are ignored.
 */
function editsFromPatch(patch) {
  const edits = [];
  let current = null;
  for (const line of patch.split("\n")) {
    const header = /^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$/.exec(line);
    if (header) {
      current = { filePath: header[1], added: [], removed: [] };
      edits.push(current);
    } else if (current && line.startsWith("+")) {
      current.added.push(line.slice(1));
    } else if (current && line.startsWith("-")) {
      current.removed.push(line.slice(1));
    }
  }
  return edits.map((e) => ({ filePath: e.filePath, added: e.added.join("\n"), removed: e.removed.join("\n") }));
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

function adaptCursor(payload) {
  const sessionId = payload.conversation_id;
  switch (payload.hook_event_name) {
    case "beforeShellExecution":
      return shellFrom(payload.command, payload, sessionId);
    case "preToolUse": {
      const input = isObject(payload.tool_input) ? payload.tool_input : {};
      if (payload.tool_name === "Shell") return shellFrom(input.command, payload, sessionId);
      if (payload.tool_name === "Write") {
        const e = editFromToolInput(input);
        return editFrom(e && [e], payload, sessionId, "Cursor Write");
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
      if (typeof input.command !== "string") {
        return unrecognised("apply_patch carried no patch text in tool_input.command");
      }
      return editFrom(editsFromPatch(input.command), payload, sessionId, "apply_patch");
    case "Edit":
    case "Write": {
      const e = editFromToolInput(input);
      return editFrom(e && [e], payload, sessionId, `Codex ${payload.tool_name}`);
    }
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
 * @param {{ policy?: object }} [options]  `policy` is evaluateCommand's deps
 * @returns {{ exitCode: 0|2, stderr: string, findings?: object[] }}
 */
export function guardPayload(tool, raw, options = {}) {
  const n = adaptPayload(tool, raw);
  if (n.kind === "unrecognised") return failOpenResult(n.reason);
  if (n.kind === "ignore") return allowResult();

  if (n.kind === "shell") {
    const verdict = evaluateCommand(n.command, options.policy ?? {});
    return verdict.action === "block" ? blockResult(verdict.reason) : allowResult();
  }

  const findings = n.edits.flatMap((edit) =>
    findViolations(edit).map((finding) => ({ ...finding, filePath: edit.filePath })),
  );
  if (findings.length === 0) return allowResult();
  const reason = findings.map((f) => `${f.filePath}:${f.line} [${f.ruleId}] ${f.why}`).join("\n");
  return { ...blockResult(reason), findings };
}
