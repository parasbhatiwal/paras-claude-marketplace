#!/usr/bin/env node
/**
 * Cursor hook: quality guard on file writes (`preToolUse` on edit tools).
 * Thin wrapper; rules are in `quality.mjs`, the escalation ladder in
 * `quality-ladder.mjs` (the one ladder Claude's `guard-quality.mjs` uses too).
 *
 * Best effort: the edit tool's payload fields are documentation-derived and
 * unconfirmed. When they are missing the adapter warns and allows.
 */

import { readFileSync } from "node:fs";

import { guardPayload } from "./hook-adapters.mjs";
import { applyLadder } from "./quality-ladder.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  // handled as an unparseable payload
}

// Quality findings need no git dependencies, so the policy context is empty.
const result = guardPayload("cursor", raw, { policy: {} });

const final = result.findings
  ? applyLadder({ tool: "cursor", findings: result.findings, sessionId: result.sessionId, cwd: result.cwd })
  : result;
process.stderr.write(final.stderr);
process.exit(final.exitCode);
