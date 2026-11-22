#!/usr/bin/env node
/**
 * Guards against silent plugin updates: if a PR changes anything a developer
 * actually executes (skills or hooks) or that decides what each tool installs
 * (tool manifests), the plugin's `version` must change too.
 * Without this, teammates pull new behavior while `/plugin` still reports the
 * same version, and there is nothing to point at when a change misbehaves.
 *
 * Usage: node scripts/check-version-bump.mjs <base-ref>   (default: origin/main)
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Files whose change requires a version bump, keyed by owning plugin dir:
 * the skills and hooks a developer executes, and every tool manifest that
 * decides what Codex or Cursor install. Root-level marketplace files belong to
 * no single plugin, so a change to one flags every known plugin directory.
 *
 * The Claude plugin manifest is deliberately absent: editing it IS the bump.
 */
const PLUGIN_FILES = /^(plugins\/[^/]+)\/(?:(?:skills|hooks)\/|plugin\.json$|\.codex-plugin\/plugin\.json$|\.cursor-plugin\/plugin\.json$)/;
const ROOT_MARKETPLACES = new Set([".agents/plugins/marketplace.json", ".cursor-plugin/marketplace.json"]);

export function pluginsNeedingBump(changedFiles, pluginDirs = []) {
  const plugins = new Set();
  for (const file of changedFiles) {
    const m = file.match(PLUGIN_FILES);
    if (m) plugins.add(m[1]);
    else if (ROOT_MARKETPLACES.has(file)) for (const dir of pluginDirs) plugins.add(dir);
  }
  return [...plugins].sort();
}

/**
 * @returns {string[]} human-readable errors (empty when the PR is compliant)
 */
export function checkBumps(changedFiles, readVersion, pluginDirs = []) {
  const errors = [];
  for (const pluginDir of pluginsNeedingBump(changedFiles, pluginDirs)) {
    const base = readVersion(pluginDir, "base");
    const head = readVersion(pluginDir, "head");
    if (base === null) continue; // new plugin — nothing to compare against
    if (base === head) {
      errors.push(
        `${pluginDir}: skills, hooks or tool manifests changed but version is still ${head} — ` +
          `bump \`version\` in ${pluginDir}/.claude-plugin/plugin.json ` +
          "(and every other manifest, which must carry the same number)"
      );
    }
  }
  return errors;
}

// --- CLI -------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const baseRef = process.argv[2] || "origin/main";
  const git = (args) => execSync(`git ${args}`, { cwd: root, encoding: "utf8" }).trim();

  const changed = git(`diff --name-only ${baseRef}...HEAD`).split("\n").filter(Boolean);

  const readVersion = (pluginDir, side) => {
    const rel = `${pluginDir}/.claude-plugin/plugin.json`;
    try {
      const raw =
        side === "base" ? git(`show ${baseRef}:${rel}`) : readFileSync(join(root, rel), "utf8");
      return JSON.parse(raw).version ?? null;
    } catch {
      return null; // file absent on that side
    }
  };

  const pluginsRoot = join(root, "plugins");
  const pluginDirs = existsSync(pluginsRoot)
    ? readdirSync(pluginsRoot)
        .filter((d) => existsSync(join(pluginsRoot, d, ".claude-plugin", "plugin.json")))
        .map((d) => `plugins/${d}`)
    : [];

  const errors = checkBumps(changed, readVersion, pluginDirs);
  if (errors.length) {
    for (const e of errors) console.error(`::error::${e}`);
    process.exit(1);
  }
  console.log("✓ plugin versions are in step with skill/hook changes");
}
