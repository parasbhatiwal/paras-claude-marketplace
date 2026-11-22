#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (Bash matcher).
 *
 * Thin I/O wrapper: reads the hook payload from stdin, hands the command to
 * the pure policy engine in `policy.mjs`, and maps the verdict onto the hook
 * contract. All rules (and their rationale) live in policy.mjs.
 *
 * Exit codes per Claude Code hook contract:
 *   0 = allow, 2 = block (stderr shown to Claude).
 */

import { readFileSync } from "node:fs";

import { evaluateCommand } from "./policy.mjs";
import { buildPolicyDeps, rememberContextRaised } from "./policy-deps.mjs";

let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let command = "";
let cwd = process.cwd();
let sessionId = "unknown";
try {
  const payload = JSON.parse(input);
  command = String(payload?.tool_input?.command ?? "");
  if (payload?.cwd) cwd = payload.cwd;
  sessionId = payload?.session_id ?? "unknown";
} catch {
  process.exit(0); // unparseable payload — do not block unrelated tooling
}

// The dependency wiring (git, gh, allowlist, autonomous flag, the once-per-
// session context reminder) is shared with the Cursor and Codex wrappers.
const verdict = evaluateCommand(command, buildPolicyDeps({ cwd, env: process.env, sessionId }));

if (verdict.action === "block") {
  // Remember that context was raised, so the next push is not stopped by the
  // same reminder.
  rememberContextRaised({ sessionId, reason: verdict.reason });

  process.stderr.write(`[team-skills guard] BLOCKED: ${verdict.reason}\n`);
  process.exit(2);
}

process.exit(0);
