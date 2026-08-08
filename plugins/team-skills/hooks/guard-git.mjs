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

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { assessContextFreshness } from "./context-freshness.mjs";
import {
  evaluateCommand,
  parseAllowlist,
  DEFAULT_SELF_MERGE_ALLOWLIST,
} from "./policy.mjs";
import { repositoryFacts } from "./repo-facts.mjs";

// Override for testing or when the owner account changes:
//   TEAM_SELF_MERGE_ALLOWLIST="alice,bob"
const allowlist = process.env.TEAM_SELF_MERGE_ALLOWLIST
  ? parseAllowlist(process.env.TEAM_SELF_MERGE_ALLOWLIST)
  : DEFAULT_SELF_MERGE_ALLOWLIST;

let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let command = "";
let cwd = process.cwd();
try {
  const payload = JSON.parse(input);
  command = String(payload?.tool_input?.command ?? "");
  if (payload?.cwd) cwd = payload.cwd;
} catch {
  process.exit(0); // unparseable payload — do not block unrelated tooling
}

const gh = (args) => {
  try {
    return execSync(`gh ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

/**
 * Whether stale context has already been raised in this session.
 *
 * Kept beside the quality guard's own ladder state, and for the same reason:
 * a rule that fires on every push until a document is perfect stops being a
 * reminder and becomes an obstacle, and obstacles get removed. This asks once.
 */
const raisedPath = join(
  tmpdir(),
  "team-skills",
  `${String(payloadSessionId()).replace(/[^\w-]/g, "")}.context-raised`,
);

function payloadSessionId() {
  try {
    return JSON.parse(input)?.session_id ?? "unknown";
  } catch {
    return "unknown";
  }
}

const verdict = evaluateCommand(command, {
  allowlist,
  getMerger: () => gh("api user --jq .login"),
  getPrAuthor: (ref) => gh(`pr view${ref ? ` ${ref}` : ""} --json author --jq .author.login`),
  contextAlreadyRaised: existsSync(raisedPath),
  getContextFreshness: () => {
    const facts = repositoryFacts(cwd);
    return facts ? assessContextFreshness(facts) : null;
  },
});

if (verdict.action === "block") {
  // Remember that context was raised, so the next push is not stopped by the
  // same reminder. Best-effort: failing to remember only means asking twice.
  if (/CLAUDE\.md is (stale|missing)/.test(verdict.reason)) {
    try {
      mkdirSync(dirname(raisedPath), { recursive: true });
      writeFileSync(raisedPath, new Date().toISOString());
    } catch {
      // why: a guard that cannot write its own scratch file must still guard
    }
  }

  process.stderr.write(`[team-skills guard] BLOCKED: ${verdict.reason}\n`);
  process.exit(2);
}

process.exit(0);
