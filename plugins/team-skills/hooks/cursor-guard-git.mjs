#!/usr/bin/env node
/**
 * Cursor hook: git guard for shell commands (`beforeShellExecution`, and
 * `preToolUse` on `Shell`). Thin wrapper; rules are in `policy.mjs`, payload
 * reading in `hook-adapters.mjs`. Best effort, built from Cursor's documentation
 * and not verified by the maintainer. Exit 2 blocks; anything else fails open.
 */

import { readFileSync } from "node:fs";

import { guardPayload } from "./hook-adapters.mjs";
import { buildPolicyDeps, rememberContextRaised } from "./policy-deps.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  // An unreadable stdin is handled as an unparseable payload below.
}

const result = guardPayload("cursor", raw, {
  policy: ({ cwd, sessionId }) => buildPolicyDeps({ cwd, env: process.env, sessionId }),
});
if (result.exitCode === 2) rememberContextRaised(result);
process.stderr.write(result.stderr);
process.exit(result.exitCode);
