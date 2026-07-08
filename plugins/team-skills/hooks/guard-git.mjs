#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (Bash matcher).
 *
 * Blocks, inside Claude sessions:
 *  - git commit without BOTH required Co-Authored-By trailers
 *    (human + Claude), unless the commit message can't be inspected
 *    (-F/-t/--amend without -m) — those are left to the git commit-msg hook.
 *  - any git commit/push with --no-verify / -n
 *  - force push (--force / -f / --force-with-lease) to main/master
 *  - history rewrites targeting main/master (rebase/reset --hard on main)
 *
 * Exit codes per Claude Code hook contract:
 *   0 = allow, 2 = block (stderr shown to Claude).
 */

import { readFileSync } from "node:fs";

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

if (!/\bgit\b/.test(command)) process.exit(0);

const block = (msg) => {
  process.stderr.write(`[team-skills guard] BLOCKED: ${msg}\n`);
  process.exit(2);
};

// --- universal: never bypass verification -------------------------------
// -n is --no-verify for commit/push; match it only next to those subcommands
// to avoid false positives (e.g. `git log -n 5`).
if (/\bgit\b[^|;&]*\b(commit|push)\b[^|;&]*(--no-verify|\s-n\b)/.test(command)) {
  block(
    "git commit/push with --no-verify is not allowed. Fix the failing gate instead of bypassing it."
  );
}

// --- force push to protected branches ------------------------------------
if (/\bgit\b[^|;&]*\bpush\b[^|;&]*(--force(-with-lease)?\b|\s-f\b)/.test(command)) {
  if (/\b(main|master)\b/.test(command)) {
    block("force-pushing to main/master is not allowed.");
  }
  // force push to a feature branch: allow but it still must be user-approved
  // via the push-branch skill; git hooks/CI remain the wall.
}

// --- history rewrites on protected branches ------------------------------
if (/\bgit\b[^|;&]*\b(rebase|reset\s+--hard|filter-branch|push\s+[^|;&]*--delete)\b/.test(command)
    && /\b(main|master)\b/.test(command)) {
  block("history rewrites / deletions targeting main/master are not allowed.");
}

// --- commit message trailer enforcement ----------------------------------
const isCommit = /\bgit\b[^|;&]*\bcommit\b/.test(command);
if (isCommit) {
  const hasInlineMessage = /\s(-m|--message)\b/.test(command) || /<<\s*['"]?EOF/.test(command);
  if (hasInlineMessage) {
    const hasClaude = /Co-Authored-By:\s*Claude/i.test(command);
    // any second Co-Authored-By line that is NOT the Claude one counts as human
    const coAuthored = command.match(/Co-Authored-By:[^\n]*/gi) ?? [];
    const hasHuman = coAuthored.some((l) => !/claude/i.test(l));
    if (!hasClaude || !hasHuman) {
      block(
        "commit message must contain BOTH trailers:\n" +
          "  Co-Authored-By: <human name> <human email>   (from git config)\n" +
          "  Co-Authored-By: Claude <noreply@anthropic.com>\n" +
          "Use the commit-changes skill to draft a compliant message."
      );
    }
  }
  // -F/-t/--amend without -m: message not inspectable here; the committed
  // commit-msg git hook enforces the same rule server-side of this check.
}

process.exit(0);
