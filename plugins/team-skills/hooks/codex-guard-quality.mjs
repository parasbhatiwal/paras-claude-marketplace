#!/usr/bin/env node
/**
 * Codex PreToolUse hook for file edits (matcher "apply_patch", "Edit", "Write"):
 * the quality guard. BEST EFFORT.
 *
 * Thin I/O wrapper. Rules live in `quality.mjs`, the payload adapter in
 * `hook-adapters.mjs`, the escalation ladder in `escalation.mjs`. The adapter
 * blocks on every finding, so this wrapper applies the ladder exactly as
 * `guard-quality.mjs` does for Claude Code:
 *
 *   - a `// why: <reason>` comment beside the line passes immediately (that is
 *     the rule module's own exemption);
 *   - otherwise the same rule on the same file is refused twice (explain, then
 *     insist) and let through on the third attempt, recorded in
 *     `.agents/engineering-overrides.md` at the git root (not Claude's `.claude/`
 *     folder: a Codex repo should not grow one) so the override is visible in review.
 *
 * Attempt counts live per session in the OS temp directory, never in the repo.
 * No session_id in the payload: keyed by a hash of cwd plus today's date.
 * Only EDIT tools reach this hook: edits made through shell commands (heredocs,
 * tee, sed -i) bypass it.
 * When the payload lacks the fields the adapter needs, it warns and allows.
 *
 * Exit codes: 0 = allow, 2 = block with the reason on stderr.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import { attemptKey, renderOverrideRecord, renderVerdict, verdictFor } from "./escalation.mjs";
import { adaptPayload, failOpenResult, guardPayload } from "./hook-adapters.mjs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.stderr.write(failOpenResult("could not read the hook payload from stdin").stderr);
  process.exit(0);
}

const normalized = adaptPayload("codex", raw);
if (normalized.kind === "unrecognised") {
  process.stderr.write(failOpenResult(normalized.reason).stderr);
  process.exit(0);
}
if (normalized.kind !== "edit") process.exit(0); // shell commands belong to codex-guard-git.mjs

// Edits never consult git or gh, so the policy deps are empty by design.
const verdict = guardPayload("codex", raw, { policy: {} });
if (!verdict.findings || verdict.findings.length === 0) {
  process.stderr.write(verdict.stderr);
  process.exit(0);
}

const byFile = new Map();
for (const finding of verdict.findings) {
  byFile.set(finding.filePath, [...(byFile.get(finding.filePath) ?? []), finding]);
}

// ---------------------------------------------------------------------------
// How often have we already refused these exact rules for these exact files?

// Without a session_id the ladder is keyed by a hash of the working directory
// and today's date: two projects never share a counter, and a new day starts a
// fresh argument. (A shared literal key would let one repo's refusals count
// toward another's override.)
const sessionKey =
  typeof normalized.sessionId === "string" && normalized.sessionId
    ? normalized.sessionId.replace(/[^\w-]/g, "")
    : `cwd-${createHash("sha256")
        .update(`${normalized.cwd ?? process.cwd()}\n${new Date().toISOString().slice(0, 10)}`)
        .digest("hex")
        .slice(0, 16)}`;

const statePath = join(tmpdir(), "team-skills", `codex-${sessionKey}.json`);

const readState = () => {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
};

const writeState = (state) => {
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // why: a guard that cannot remember still guards; it just always says no first
  }
};

const state = readState();
const judged = [...byFile].map(([filePath, findings]) => {
  const attempts = findings.map((f) => state[attemptKey(filePath, f.ruleId)] ?? 0);
  return { filePath, findings, ...verdictFor(Math.min(...attempts)) };
});
const blocked = judged.filter((j) => j.action === "block");

// Only count what is actually refused. A file that would be conceded while a
// sibling file still blocks keeps its count, so it is conceded (and recorded)
// exactly once, on the call that really lets it through.
for (const j of blocked.length > 0 ? blocked : judged) {
  for (const f of j.findings) {
    const key = attemptKey(j.filePath, f.ruleId);
    state[key] = (state[key] ?? 0) + 1;
  }
}
writeState(state);

if (blocked.length > 0) {
  const body = blocked.map((j) => renderVerdict(j.findings, j.filePath, j.tone)).join("\n\n");
  process.stderr.write(`[team-skills guard] BLOCKED\n${body}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Conceding, but on the record.

const gitRoot = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: normalized.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
})();

if (gitRoot) {
  const ledger = join(gitRoot, ".agents", "engineering-overrides.md");
  try {
    mkdirSync(dirname(ledger), { recursive: true });
    if (!existsSync(ledger)) {
      writeFileSync(
        ledger,
        "# Engineering overrides\n\n" +
          "Every time the team's quality guard was overruled, and on what. This file\n" +
          "is written by the guard, not by hand. A long list here is not a scandal;\n" +
          "it is a reading list for the next `principles-audit`, and a hint that a\n" +
          "rule may be wrong rather than the code.\n\n",
      );
    }
    const when = new Date().toISOString();
    for (const j of judged) appendFileSync(ledger, `${renderOverrideRecord(j.findings, j.filePath, when)}\n`);
  } catch {
    // why: recording is best effort and must not fail the edit asked for three times
  }
}

const body = judged.map((j) => renderVerdict(j.findings, j.filePath, j.tone)).join("\n\n");
process.stderr.write(`[team-skills guard] ${body}\n`);
process.exit(0);
