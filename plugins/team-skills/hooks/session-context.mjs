#!/usr/bin/env node
/**
 * Claude Code SessionStart hook.
 *
 * Checks whether the project's CLAUDE.md has drifted from the repository and,
 * if so, injects a short notice so the session starts by refreshing context
 * instead of working from stale facts. Silent when the context is fresh —
 * this runs on every session, so it must be fast and quiet.
 *
 * Noticing is all this does. Insisting happens at push time, in
 * `guard-git.mjs`: a notice at the start of a session is read once and then
 * outlived by the work that makes it wrong.
 *
 * Rules live in `context-freshness.mjs`; repository reads in `repo-facts.mjs`;
 * this file is the hook contract and nothing else.
 */

import { readFileSync } from "node:fs";

import { assessContextFreshness, renderNotice } from "./context-freshness.mjs";
import { repositoryFacts } from "./repo-facts.mjs";

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

const facts = repositoryFacts(cwd);

// Only meaningful inside a git repository.
if (!facts) emit(null);

emit(renderNotice(assessContextFreshness(facts)));
