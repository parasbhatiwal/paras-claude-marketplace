/**
 * The escalation ladder for quality findings, for wrappers that get findings
 * from `guardPayload` (Cursor, Codex) instead of judging edits themselves.
 *
 * It mirrors what `guard-quality.mjs` does for Claude Code, using the same pure
 * rules in `escalation.mjs`: block with an explanation, insist, then concede on
 * the record in `.claude/engineering-overrides.md`. Without it a legitimate
 * exception could never be justified and a blocked retry would loop forever.
 *
 * Attempt counts live per session in the OS temp directory (a new session is a
 * fresh argument) and never in the user's repository. Persisting is best
 * effort: a guard that cannot remember still guards.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { attemptKey, renderOverrideRecord, renderVerdict, verdictFor } from "./escalation.mjs";

const PREFIX = "[team-skills guard]";

const statePathFor = (sessionId) =>
  join(tmpdir(), "team-skills", `${String(sessionId ?? "unknown").replace(/[^\w-]/g, "")}.json`);

const readState = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};

const writeState = (path, state) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state));
  } catch {
    // Failing to persist must never fail the user's edit.
  }
};

const gitRootOf = (cwd) => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const byFile = (findings) => {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.filePath)) groups.set(f.filePath, []);
    groups.get(f.filePath).push(f);
  }
  return groups;
};

const recordOverrides = (groups, cwd) => {
  const root = gitRootOf(cwd ?? process.cwd());
  if (!root) return;
  const ledger = join(root, ".claude", "engineering-overrides.md");
  try {
    mkdirSync(dirname(ledger), { recursive: true });
    if (!existsSync(ledger)) {
      writeFileSync(
        ledger,
        "# Engineering overrides\n\n" +
          "Every time the team's quality guard was overruled, and on what. This file\n" +
          "is written by the guard, not by hand. A long list here is not a scandal -\n" +
          "it is a reading list for the next `principles-audit`, and a hint that a\n" +
          "rule may be wrong rather than the code.\n\n",
      );
    }
    const when = new Date().toISOString();
    for (const [filePath, findings] of groups) {
      appendFileSync(ledger, `${renderOverrideRecord(findings, filePath, when)}\n`);
    }
  } catch {
    // Recording is best effort.
  }
};

/**
 * @param {{ findings: object[], sessionId?: string, cwd?: string }} args
 *        findings as returned by `guardPayload` (each carries `filePath`).
 * @returns {{ exitCode: 0|2, stderr: string }}
 */
export function applyLadder({ findings, sessionId, cwd }) {
  if (!findings || findings.length === 0) return { exitCode: 0, stderr: "" };

  const statePath = statePathFor(sessionId);
  const state = readState(statePath);

  // The ladder advances on the rule argued about least, so a new problem in a
  // file already under discussion still gets its full explanation.
  const attempts = findings.map((f) => state[attemptKey(f.filePath, f.ruleId)] ?? 0);
  const { action, tone } = verdictFor(Math.min(...attempts));

  for (const f of findings) {
    const key = attemptKey(f.filePath, f.ruleId);
    state[key] = (state[key] ?? 0) + 1;
  }
  writeState(statePath, state);

  const groups = byFile(findings);
  const message = [...groups].map(([filePath, fs]) => renderVerdict(fs, filePath, tone)).join("\n\n");

  if (action === "block") {
    return { exitCode: 2, stderr: `${PREFIX} BLOCKED\n${message}\n` };
  }
  recordOverrides(groups, cwd);
  return { exitCode: 0, stderr: `${PREFIX} ${message}\n` };
}
