#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (Write / Edit matcher).
 *
 * Thin I/O wrapper. The rules live in `quality.mjs`; how many times the guard
 * says no before stepping aside lives in `escalation.mjs` and is applied by
 * `quality-ladder.mjs`, the one ladder shared with the Cursor and Codex
 * wrappers. This file only reads the payload and maps the verdict onto the
 * hook contract.
 *
 * Exit codes per Claude Code hook contract:
 *   0 = allow, 2 = block (stderr is shown to Claude, which then has to respond).
 */

import { readFileSync } from "node:fs";

import { findViolations } from "./quality.mjs";
import { applyLadder } from "./quality-ladder.mjs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // unparseable payload — never block unrelated tooling
}

const input = payload?.tool_input ?? {};
const filePath = String(input.file_path ?? input.notebook_path ?? "");
const removed = String(input.old_string ?? "");

/**
 * The text this call would add, whichever tool is calling.
 *
 * `Write` carries the whole file; `Edit` carries the replacement. `MultiEdit`
 * carries a list, and every replacement in it is judged — one clean edit in a
 * batch must not launder a dirty one.
 */
const added = [
  input.content,
  input.new_string,
  input.new_source,
  ...(Array.isArray(input.edits) ? input.edits.map((edit) => edit?.new_string) : []),
]
  .filter((value) => typeof value === "string")
  .join("\n");

const findings = findViolations({ filePath, added, removed });
if (findings.length === 0) process.exit(0);

const result = applyLadder({
  tool: "claude",
  findings: findings.map((finding) => ({ ...finding, filePath })),
  sessionId: payload?.session_id,
  cwd: payload?.cwd ?? process.cwd(),
});
process.stderr.write(result.stderr);
process.exit(result.exitCode);
