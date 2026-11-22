#!/usr/bin/env node
/**
 * Cursor `sessionStart` hook: context-freshness notice plus the workflow nudge,
 * returned as `{"additional_context": "..."}`. Cursor cloud agents do not run
 * `sessionStart`; that is accepted. Best effort, not verified by the maintainer.
 * Always exits 0 and is silent outside a git repository.
 */

import { readFileSync } from "node:fs";

import { assessContextFreshness, renderNotice } from "./context-freshness.mjs";
import { repositoryFacts } from "./repo-facts.mjs";
import { withWorkflowNudge } from "./workflow-nudge.mjs";

let cwd = process.cwd();
try {
  const payload = JSON.parse(readFileSync(0, "utf8"));
  const root = Array.isArray(payload?.workspace_roots) ? payload.workspace_roots[0] : undefined;
  cwd = payload?.cwd ?? root ?? cwd;
} catch {
  // no or unparseable payload: fall back to cwd
}

const facts = repositoryFacts(cwd);
if (facts) {
  const context = withWorkflowNudge(renderNotice(assessContextFreshness(facts)));
  process.stdout.write(JSON.stringify({ additional_context: context }));
}
process.exit(0);
