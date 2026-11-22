#!/usr/bin/env node
/**
 * Cursor `sessionStart` hook: context-freshness notice plus the workflow nudge,
 * returned as `{"additional_context": "..."}`. Cursor cloud agents do not run
 * `sessionStart`; that is accepted. Best effort, not verified by the maintainer.
 * Always exits 0 and is silent outside a git repository.
 *
 * The directory is `cwd`, else the workspace roots (file:// URIs converted); the
 * first one that is a git repository wins.
 */

import { readFileSync } from "node:fs";

import { assessContextFreshness, renderNotice } from "./context-freshness.mjs";
import { workspaceDirs } from "./hook-adapters.mjs";
import { repositoryFacts } from "./repo-facts.mjs";
import { withWorkflowNudge } from "./workflow-nudge.mjs";

let dirs = [];
try {
  dirs = workspaceDirs(JSON.parse(readFileSync(0, "utf8")));
} catch {
  // no or unparseable payload: fall back to the process directory
}
if (dirs.length === 0) dirs = [process.cwd()];

let facts = null;
for (const dir of dirs) {
  facts = repositoryFacts(dir);
  if (facts) break;
}

if (facts) {
  const context = withWorkflowNudge(renderNotice(assessContextFreshness(facts)));
  process.stdout.write(JSON.stringify({ additional_context: context }));
}
process.exit(0);
