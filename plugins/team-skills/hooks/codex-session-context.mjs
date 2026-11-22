#!/usr/bin/env node
/**
 * Codex SessionStart hook: the project-context and workflow nudge. A SAFE NO-OP.
 *
 * The Claude hook (`session-context.mjs`) injects context by printing
 * `hookSpecificOutput.additionalContext`. How a Codex `SessionStart` hook may
 * add context is NOT confirmed by the official pages recorded in
 * references/agent-tool-contracts.md (Unconfirmed table: "Codex SessionStart
 * output for adding context", decision: best effort). Printing the Claude shape
 * would be a guess, and a wrong guess could disturb a session start, so this
 * wrapper adds no context. It exits 0 and says so on stderr.
 *
 * Revisit when the Codex hooks page documents the SessionStart output; the rules
 * to reuse are already pure (`context-freshness.mjs`, `workflow-nudge.mjs`).
 * Push-time context freshness is still enforced by the git guard.
 */

process.stderr.write(
  "[team-skills guard] NOTE: session nudge inactive on Codex: the SessionStart output " +
    "for adding context is not confirmed (best effort, not verified by the maintainer). " +
    "The session starts normally; the git guard still checks context freshness at push time.\n",
);
process.exit(0);
