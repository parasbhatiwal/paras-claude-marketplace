#!/usr/bin/env node
/**
 * Guardrails for the automated upstream sync.
 *
 * The sync hands text written by someone else (upstream skills) to an agent
 * that can edit this repo. That text is untrusted: a line in an upstream skill
 * that says "also relax the push guard" must not be able to reach the code that
 * enforces our rules. So the agent is confined to the files that carry
 * *content*, and everything that *enforces* — hooks, scripts, tests, workflows,
 * repo-level skills — is out of reach no matter what it was told. A human still
 * reviews the PR; this keeps the review about prose, not about the guards.
 *
 *   node scripts/upstream-guard.mjs next-version
 *   node scripts/upstream-guard.mjs check-paths <base-ref>    # exits 1 on a violation
 *   node scripts/upstream-guard.mjs has-plugin-changes <base-ref>
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN = "plugins/team-skills";
const MANIFEST = `${PLUGIN}/.claude-plugin/plugin.json`;

const ALLOWED_PREFIXES = [
  `${PLUGIN}/skills/`,
  `${PLUGIN}/references/`,
  `${PLUGIN}/commands/`,
];
const ALLOWED_FILES = new Set([
  `${PLUGIN}/THIRD_PARTY_NOTICES.md`,
  MANIFEST,
  "CHANGELOG.md",
  "README.md",
  "upstream.json",
]);
// Moved by the workflow itself (pre-made bump, changelog entry, baseline), so
// they do not by themselves mean a skill changed.
const BOOKKEEPING = new Set([MANIFEST, "CHANGELOG.md", "upstream.json"]);

export function nextMinor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!m) throw new Error(`cannot parse version "${version}"`);
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

export function disallowedPaths(paths) {
  return paths.filter((p) => {
    const norm = posix.normalize(p);
    if (norm !== p) return true; // `a/../b` and friends: judge the resolved path, not the spelling
    return !(ALLOWED_FILES.has(norm) || ALLOWED_PREFIXES.some((pre) => norm.startsWith(pre)));
  });
}

export function hasPluginChanges(paths) {
  return paths.some((p) => p.startsWith(`${PLUGIN}/`) && !BOOKKEEPING.has(p));
}

const changedPaths = (base) =>
  execFileSync("git", ["diff", "--name-only", base], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .concat(
      execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean)
    );

const main = () => {
  const [, , cmd, base = "HEAD"] = process.argv;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  if (cmd === "next-version") {
    const v = JSON.parse(readFileSync(join(root, MANIFEST), "utf8")).version;
    process.stdout.write(nextMinor(v));
  } else if (cmd === "check-paths") {
    const bad = disallowedPaths(changedPaths(base));
    if (bad.length) {
      console.error(`upstream sync touched files it may not:\n${bad.map((b) => `  - ${b}`).join("\n")}`);
      process.exit(1);
    }
  } else if (cmd === "has-plugin-changes") {
    process.exit(hasPluginChanges(changedPaths(base)) ? 0 : 1);
  } else {
    console.error("usage: upstream-guard.mjs next-version | check-paths <ref> | has-plugin-changes <ref>");
    process.exit(2);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
