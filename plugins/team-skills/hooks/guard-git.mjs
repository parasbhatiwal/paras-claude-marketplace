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
 *  - self-merging a PR (`gh pr merge`) unless the merger is an allowlisted
 *    owner account merging their OWN PR. Team rule: only the owner may
 *    self-merge; everyone else's PR must be merged by someone else.
 *
 * Exit codes per Claude Code hook contract:
 *   0 = allow, 2 = block (stderr shown to Claude).
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Accounts allowed to merge their own PRs. Override for testing or when the
// owner account changes: TEAM_SELF_MERGE_ALLOWLIST="alice,bob"
const SELF_MERGE_ALLOWLIST = (process.env.TEAM_SELF_MERGE_ALLOWLIST ?? "parasbhatiwal")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

const block = (msg) => {
  process.stderr.write(`[team-skills guard] BLOCKED: ${msg}\n`);
  process.exit(2);
};

// --- PR merge policy (gh pr merge) ---------------------------------------
// Self-merge is allowed only for allowlisted owner accounts merging their
// own PR. Anyone else's PR must be merged by a different person.
const mergeMatch = command.match(/\bgh\s+pr\s+merge\b(?:\s+(\d+|\S*#\d+|https?:\/\/\S+))?/);
if (mergeMatch) {
  const gh = (args) => {
    try {
      return execSync(`gh ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch {
      return null;
    }
  };
  const merger = gh("api user --jq .login");
  const prRef = mergeMatch[1] ? ` ${mergeMatch[1]}` : "";
  const author = gh(`pr view${prRef} --json author --jq .author.login`);
  if (!merger || !author) {
    block(
      "cannot verify PR author/merger identity (gh unavailable?). " +
        "Self-merge policy requires verification — retry when gh works."
    );
  }
  if (merger === author && !SELF_MERGE_ALLOWLIST.includes(merger)) {
    block(
      `self-merge not allowed: @${merger} authored this PR. ` +
        "Team rule: only the owner account may self-merge; ask a teammate to review and merge."
    );
  }
  process.exit(0);
}

if (!/\bgit\b/.test(command)) process.exit(0);

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
