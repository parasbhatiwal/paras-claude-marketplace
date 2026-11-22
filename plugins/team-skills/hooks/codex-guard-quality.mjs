#!/usr/bin/env node
/**
 * Codex PreToolUse hook for file edits (matcher "apply_patch", "Edit", "Write"):
 * the quality guard. BEST EFFORT.
 *
 * Thin I/O wrapper. Rules live in `quality.mjs`, the payload adapter in
 * `hook-adapters.mjs`, and the escalation ladder in `quality-ladder.mjs` (the one
 * ladder Claude's `guard-quality.mjs` and the Cursor wrapper use too): a
 * `// why: <reason>` comment passes immediately; otherwise the same rule on the
 * same file is refused twice and conceded on the third attempt, recorded in
 * `.agents/engineering-overrides.md` at the git root (not Claude's `.claude/`).
 *
 * No `session_id` in the payload: the ladder is keyed by a hash of the working
 * directory plus today's date, so two projects never share a counter and a new
 * day starts a fresh argument.
 *
 * Only EDIT tools reach this hook: edits made through shell commands (heredocs,
 * tee, sed -i) bypass it. When the payload lacks the fields the adapter needs,
 * it warns and allows.
 *
 * Exit codes: 0 = allow, 2 = block with the reason on stderr.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { adaptPayload, failOpenResult, guardPayload } from "./hook-adapters.mjs";
import { applyLadder } from "./quality-ladder.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.stderr.write(failOpenResult("could not read the hook payload from stdin").stderr);
  process.exit(0);
}

let payload = raw;
try {
  payload = JSON.parse(raw);
} catch {
  // the adapter reports it as unparseable and the guard fails open
}

const normalized = adaptPayload("codex", payload);
if (normalized.kind === "unrecognised") {
  process.stderr.write(failOpenResult(normalized.reason).stderr);
  process.exit(0);
}
if (normalized.kind !== "edit") process.exit(0); // shell commands belong to codex-guard-git.mjs

// Edits never consult git or gh, so the policy deps are empty by design.
const verdict = guardPayload("codex", payload, { policy: {} });
if (!verdict.findings || verdict.findings.length === 0) {
  process.stderr.write(verdict.stderr);
  process.exit(0);
}

const cwd = normalized.cwd ?? process.cwd();
const sessionId =
  typeof normalized.sessionId === "string" && normalized.sessionId
    ? normalized.sessionId
    : `cwd-${createHash("sha256")
        .update(`${cwd}\n${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
        .slice(0, 16)}`;

const final = applyLadder({ tool: "codex", findings: verdict.findings, sessionId, cwd });
process.stderr.write(final.stderr);
process.exit(final.exitCode);
