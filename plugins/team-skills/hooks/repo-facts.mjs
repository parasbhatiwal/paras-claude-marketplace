/**
 * Reading the repository facts that `assessContextFreshness` needs.
 *
 * Two hooks need this now — `session-context.mjs` to notice drift when a
 * session opens, and `guard-git.mjs` to insist on it before a push — so it
 * lives in one place rather than twice. Two copies of "how do we tell whether
 * CLAUDE.md is stale" would drift apart, and the one that drifted would be the
 * one nobody was looking at.
 *
 * All the I/O is here, deliberately: `context-freshness.mjs` stays pure and
 * testable, and this file is the only thing that has to know about `git`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Run git, or answer `null`. A missing git is not an error worth raising here. */
function git(cwd, ...args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Everything `assessContextFreshness` asks for, or `null` outside a repository.
 *
 * @param {string} cwd
 * @returns {{claudeMd: string|null, commitsSince: number, changedFiles: string[], shaKnown: boolean, root: string}|null}
 */
export function repositoryFacts(cwd = process.cwd()) {
  const root = git(cwd, "rev-parse", "--show-toplevel");
  if (!root) return null;

  const claudeMdPath = join(root, "CLAUDE.md");
  const claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf8") : null;

  let commitsSince = 0;
  let changedFiles = [];
  let shaKnown = true;

  const sha = claudeMd?.match(/claude-context:\s*sha=([0-9a-f]{7,40})/i)?.[1];
  if (sha) {
    shaKnown = git(root, "cat-file", "-e", `${sha}^{commit}`) !== null;
    if (shaKnown) {
      commitsSince = Number(git(root, "rev-list", "--count", `${sha}..HEAD`) ?? 0);
      changedFiles = (git(root, "diff", "--name-only", `${sha}..HEAD`) ?? "")
        .split("\n")
        .filter(Boolean);
    }
  }

  return { claudeMd, commitsSince, changedFiles, shaKnown, root };
}
