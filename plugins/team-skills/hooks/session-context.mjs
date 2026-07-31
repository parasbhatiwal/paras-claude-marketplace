#!/usr/bin/env node
/**
 * Claude Code SessionStart hook.
 *
 * Checks whether the project's CLAUDE.md has drifted from the repository and,
 * if so, injects a short notice so the session starts by refreshing context
 * instead of working from stale facts. Silent when the context is fresh —
 * this runs on every session, so it must be fast and quiet.
 *
 * Rules live in `context-freshness.mjs`; this file is I/O only.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { assessContextFreshness, renderNotice } from "./context-freshness.mjs";

const emit = (context) => {
  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
      })
    );
  }
  process.exit(0);
};

let cwd = process.cwd();
try {
  const payload = JSON.parse(readFileSync(0, "utf8"));
  if (payload?.cwd) cwd = payload.cwd;
} catch {
  // no/!parseable payload — fall back to cwd
}

const git = (...args) => {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

// Only meaningful inside a git repository.
const root = git("rev-parse", "--show-toplevel");
if (!root) emit(null);

const claudeMdPath = join(root, "CLAUDE.md");
const claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf8") : null;

let commitsSince = 0;
let changedFiles = [];
let shaKnown = true;

const fingerprintSha = claudeMd?.match(/claude-context:\s*sha=([0-9a-f]{7,40})/i)?.[1];
if (fingerprintSha) {
  shaKnown = git("cat-file", "-e", `${fingerprintSha}^{commit}`) !== null;
  if (shaKnown) {
    commitsSince = Number(git("rev-list", "--count", `${fingerprintSha}..HEAD`) ?? 0);
    changedFiles = (git("diff", "--name-only", `${fingerprintSha}..HEAD`) ?? "")
      .split("\n")
      .filter(Boolean);
  }
}

emit(renderNotice(assessContextFreshness({ claudeMd, commitsSince, changedFiles, shaKnown })));
