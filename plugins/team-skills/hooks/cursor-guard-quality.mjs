#!/usr/bin/env node
/**
 * Cursor hook: quality guard on file writes (`preToolUse` on edit tools).
 * Thin wrapper; rules are in `quality.mjs`, the escalation ladder in
 * `quality-ladder.mjs` (same behaviour as `guard-quality.mjs` for Claude).
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

let cwd;
const result = guardPayload("cursor", raw, {
  policy: (normalized) => {
    cwd = normalized.cwd;
    return {}; // quality findings need no git dependencies
  },
});

const final = result.findings
  ? applyLadder({ findings: result.findings, sessionId: result.sessionId, cwd })
  : result;
process.stderr.write(final.stderr);
process.exit(final.exitCode);
