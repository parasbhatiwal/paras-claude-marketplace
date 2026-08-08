#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (Write / Edit matcher).
 *
 * Thin I/O wrapper. The rules live in `quality.mjs`; how many times the guard
 * says no before stepping aside lives in `escalation.mjs`. This file only reads
 * the payload, remembers how often each rule has already been refused for each
 * file, and maps the verdict onto the hook contract.
 *
 * Attempt counts are kept per session in the OS temp directory: the ladder must
 * reset when a new session starts (a fresh session is a fresh argument) and must
 * never leave anything behind in the user's repository.
 *
 * Exit codes per Claude Code hook contract:
 *   0 = allow, 2 = block (stderr is shown to Claude, which then has to respond).
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { findViolations } from "./quality.mjs";
import {
  attemptKey,
  renderOverrideRecord,
  renderVerdict,
  verdictFor,
} from "./escalation.mjs";

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

// ---------------------------------------------------------------------------
// How often have we already refused these exact rules for this exact file?

const statePath = join(
  tmpdir(),
  "team-skills",
  `${String(payload?.session_id ?? "unknown").replace(/[^\w-]/g, "")}.json`,
);

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
    // A guard that cannot remember still guards; it just always says no on the
    // first tone. Failing to persist must never fail the user's edit.
  }
};

const state = readState();

// The ladder advances on the rule that has been argued about least, so a new
// problem appearing in a file already under discussion still gets its full
// explanation rather than inheriting somebody else's third strike.
const attempts = findings.map((finding) => state[attemptKey(filePath, finding.ruleId)] ?? 0);
const { action, tone } = verdictFor(Math.min(...attempts));

for (const finding of findings) {
  const key = attemptKey(filePath, finding.ruleId);
  state[key] = (state[key] ?? 0) + 1;
}
writeState(state);

if (action === "block") {
  process.stderr.write(`[team-skills guard] BLOCKED\n${renderVerdict(findings, filePath, tone)}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Conceding — but on the record.

const gitRoot = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: payload?.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
})();

if (gitRoot) {
  const ledger = join(gitRoot, ".claude", "engineering-overrides.md");
  try {
    mkdirSync(dirname(ledger), { recursive: true });
    if (!existsSync(ledger)) {
      writeFileSync(
        ledger,
        "# Engineering overrides\n\n" +
          "Every time the team's quality guard was overruled, and on what. This file\n" +
          "is written by the guard, not by hand. A long list here is not a scandal —\n" +
          "it is a reading list for the next `principles-audit`, and a hint that a\n" +
          "rule may be wrong rather than the code.\n\n",
      );
    }
    appendFileSync(ledger, `${renderOverrideRecord(findings, filePath, new Date().toISOString())}\n`);
  } catch {
    // Recording is best-effort. Failing to write the ledger must not fail the
    // edit the user has now asked for three times.
  }
}

process.stderr.write(`[team-skills guard] ${renderVerdict(findings, filePath, tone)}\n`);
process.exit(0);
