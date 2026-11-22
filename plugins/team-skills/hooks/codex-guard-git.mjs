#!/usr/bin/env node
/**
 * Codex PreToolUse hook for shell commands (matcher "Bash"): the git guard.
 *
 * Thin I/O wrapper around the Codex adapter in `hook-adapters.mjs` and the real
 * rules in `policy.mjs`. BEST EFFORT: payload fields come from official Codex
 * documentation (see references/agent-tool-contracts.md), not from a recorded
 * real session, and Codex hooks need a one-time trust step and can be bypassed.
 * Git hooks and CI stay the real wall.
 *
 * Exit codes: 0 = allow (also when the payload cannot be understood, with a
 * "guard inactive" warning on stderr), 2 = block with the reason on stderr.
 *
 * This wrapper judges shell commands only. File edits (apply_patch) belong to
 * `codex-guard-quality.mjs`, which applies the escalation ladder; an edit event
 * reaching this wrapper is allowed untouched.
 */

import { readFileSync } from "node:fs";

import { adaptPayload, failOpenResult, guardPayload } from "./hook-adapters.mjs";
import { buildPolicyDeps, rememberContextRaised } from "./policy-deps.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.stderr.write(failOpenResult("could not read the hook payload from stdin").stderr);
  process.exit(0);
}

// Parse once; an unparseable payload stays a string and the adapter fails open.
let payload = raw;
try {
  payload = JSON.parse(raw);
} catch {
  // reported by the adapter as "payload is not valid JSON"
}

if (adaptPayload("codex", payload).kind === "edit") process.exit(0);

const result = guardPayload("codex", payload, {
  policy: ({ cwd, sessionId }) => buildPolicyDeps({ cwd, env: process.env, sessionId }),
});
if (result.exitCode === 2) rememberContextRaised(result);
process.stderr.write(result.stderr);
process.exit(result.exitCode);
