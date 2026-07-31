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
import { execSync } from "node:child_process";
import {
  evaluateCommand,
  parseAllowlist,
  DEFAULT_SELF_MERGE_ALLOWLIST,
} from "./policy.mjs";

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
try {
  const payload = JSON.parse(input);
  command = String(payload?.tool_input?.command ?? "");
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

const verdict = evaluateCommand(command, {
  allowlist,
  getMerger: () => gh("api user --jq .login"),
  getPrAuthor: (ref) => gh(`pr view${ref ? ` ${ref}` : ""} --json author --jq .author.login`),
});

if (verdict.action === "block") {
  process.stderr.write(`[team-skills guard] BLOCKED: ${verdict.reason}\n`);
  process.exit(2);
}

process.exit(0);
