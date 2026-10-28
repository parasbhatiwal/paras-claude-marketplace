#!/usr/bin/env node
/**
 * Decides whether `stable` should be fast-forwarded to `main`.
 *
 * Automates the release step that fails silently when forgotten — but only
 * when it would actually deliver something. Claude Code skips a plugin update
 * whose `version` string is unchanged, so moving `stable` without a version
 * bump publishes nothing and only hides the mistake; and a `stable` that is not
 * an ancestor of `main` cannot be fast-forwarded (roll forward, never rewind).
 *
 *   node scripts/release-needed.mjs [stable-ref] [main-ref]   # prints a verdict, exit 0 = release
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MANIFEST = "plugins/team-skills/.claude-plugin/plugin.json";

export function releaseNeeded(cwd, stable = "origin/stable", main = "origin/main") {
  const git = (...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const version = (ref) => JSON.parse(git("show", `${ref}:${MANIFEST}`)).version;

  try {
    git("merge-base", "--is-ancestor", stable, main);
  } catch {
    return { release: false, reason: `${stable} is not an ancestor of ${main}; cannot fast-forward` };
  }
  if (git("rev-parse", stable) === git("rev-parse", main)) {
    return { release: false, reason: `${stable} already equals ${main}` };
  }
  const [from, to] = [version(stable), version(main)];
  if (from === to) {
    return { release: false, reason: `plugin version is still ${to}; Claude Code would skip the update` };
  }
  return { release: true, reason: `${from} -> ${to}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , stable, main] = process.argv;
  const r = releaseNeeded(process.cwd(), stable, main);
  console.log(`${r.release ? "release" : "skip"}: ${r.reason}`);
  process.exit(r.release ? 0 : 1);
}
