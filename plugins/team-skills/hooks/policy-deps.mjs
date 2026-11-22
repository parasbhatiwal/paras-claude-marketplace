/**
 * Dependencies the git policy needs, shared by every hook wrapper.
 *
 * `evaluateCommand` (policy.mjs) is pure: it asks for the current branch, a PR's
 * base, the gh user and so on through injected functions. This module is where
 * those functions are built, so the Claude, Cursor and Codex wrappers enforce
 * exactly the same rules. A wrapper that skipped this would look active while
 * enforcing less.
 *
 * Impure by design: runs `git` and `gh`, and reads and writes a marker file in
 * the OS temp directory.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { assessContextFreshness } from "./context-freshness.mjs";
import { DEFAULT_SELF_MERGE_ALLOWLIST, parseAgentNames, parseAllowlist } from "./policy.mjs";
import { repositoryFacts } from "./repo-facts.mjs";

/**
 * Where "stale context was already raised in this session" is remembered.
 * A rule that fires on every push until a document is perfect becomes an
 * obstacle, and obstacles get removed. This asks once per session.
 */
export const contextRaisedPath = (sessionId) =>
  join(tmpdir(), "team-skills", `${String(sessionId ?? "unknown").replace(/[^\w-]/g, "")}.context-raised`);

/**
 * Record that a block was the stale-context reminder, so the next push is not
 * stopped by it again. Best effort: failing to remember only means asking twice.
 */
export function rememberContextRaised({ sessionId, reason }) {
  if (!/CLAUDE\.md is (stale|missing)/.test(reason ?? "")) return;
  const path = contextRaisedPath(sessionId);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, new Date().toISOString());
  } catch {
    // why: a guard that cannot write its own scratch file must still guard
  }
}

/**
 * @param {{ cwd?: string, env?: Record<string, string|undefined>, sessionId?: string }} ctx
 * @returns the `deps` object for `evaluateCommand`
 */
export function buildPolicyDeps({ cwd = process.cwd(), env = process.env, sessionId = "unknown" } = {}) {
  const run = (command, options = {}) => {
    try {
      return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
    } catch {
      return null;
    }
  };
  const gh = (args) => run(`gh ${args}`);
  const prRef = (ref) => (ref ? ` ${ref}` : "");

  return {
    // Set by the cloud runtime's environment, never by the agent: the hook reads
    // its own process env, so `TEAM_AUTONOMOUS=1 git push` typed in a command
    // does not reach it. See references/autonomous-mode.md.
    autonomous: env.TEAM_AUTONOMOUS === "1",
    agentTrailerNames: parseAgentNames(env.TEAM_AGENT_TRAILER_NAMES),
    allowlist: env.TEAM_SELF_MERGE_ALLOWLIST
      ? parseAllowlist(env.TEAM_SELF_MERGE_ALLOWLIST)
      : DEFAULT_SELF_MERGE_ALLOWLIST,
    getCurrentBranch: () => run("git rev-parse --abbrev-ref HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"] }),
    getPrBase: (ref) => gh(`pr view${prRef(ref)} --json baseRefName --jq .baseRefName`),
    getMerger: () => gh("api user --jq .login"),
    getPrAuthor: (ref) => gh(`pr view${prRef(ref)} --json author --jq .author.login`),
    contextAlreadyRaised: existsSync(contextRaisedPath(sessionId)),
    getContextFreshness: () => {
      const facts = repositoryFacts(cwd);
      return facts ? assessContextFreshness(facts) : null;
    },
  };
}
