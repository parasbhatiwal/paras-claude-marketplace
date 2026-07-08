#!/usr/bin/env node
/**
 * Validates the marketplace repo before anything ships to the team:
 *  - .claude-plugin/marketplace.json parses + required fields + plugin sources exist
 *  - each plugin has a valid .claude-plugin/plugin.json (name, version, description)
 *  - every skills/<name>/SKILL.md has YAML frontmatter with `name` and a
 *    non-trivial `description`, and `name` matches its directory
 *  - hooks.json (if present) parses and referenced hook scripts exist
 *
 * Exits non-zero with a readable error list on any failure.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const err = (msg) => errors.push(msg);

const readJson = (path, label) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(`${label}: cannot parse ${path}: ${e.message}`);
    return null;
  }
};

// --- marketplace.json ------------------------------------------------------
const mpPath = join(ROOT, ".claude-plugin", "marketplace.json");
if (!existsSync(mpPath)) err("missing .claude-plugin/marketplace.json");
const marketplace = existsSync(mpPath) ? readJson(mpPath, "marketplace") : null;

const pluginDirs = [];
if (marketplace) {
  if (!marketplace.name) err("marketplace.json: missing `name`");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    err("marketplace.json: `plugins` must be a non-empty array");
  } else {
    for (const p of marketplace.plugins) {
      if (!p.name) err("marketplace.json: plugin entry missing `name`");
      if (!p.source) {
        err(`marketplace.json: plugin ${p.name ?? "?"} missing \`source\``);
      } else if (typeof p.source === "string") {
        const dir = join(ROOT, p.source);
        if (!existsSync(dir)) err(`marketplace.json: source ${p.source} does not exist`);
        else pluginDirs.push(dir);
      }
    }
  }
}

// --- each plugin -----------------------------------------------------------
const parseFrontmatter = (raw, label) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    err(`${label}: missing YAML frontmatter block`);
    return {};
  }
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
};

for (const pluginDir of pluginDirs) {
  const label = pluginDir.replace(ROOT + "/", "");
  const manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    err(`${label}: missing .claude-plugin/plugin.json`);
  } else {
    const manifest = readJson(manifestPath, label);
    if (manifest) {
      for (const field of ["name", "version", "description"]) {
        if (!manifest[field]) err(`${label}/plugin.json: missing \`${field}\``);
      }
    }
  }

  // skills
  const skillsDir = join(pluginDir, "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir)) {
      const dir = join(skillsDir, entry);
      if (!statSync(dir).isDirectory()) continue;
      const skillPath = join(dir, "SKILL.md");
      const sLabel = `${label}/skills/${entry}`;
      if (!existsSync(skillPath)) {
        err(`${sLabel}: missing SKILL.md`);
        continue;
      }
      const fm = parseFrontmatter(readFileSync(skillPath, "utf8"), sLabel);
      if (!fm.name) err(`${sLabel}: frontmatter missing \`name\``);
      else if (fm.name !== entry) {
        err(`${sLabel}: frontmatter name \`${fm.name}\` != directory \`${entry}\``);
      }
      if (!fm.description) err(`${sLabel}: frontmatter missing \`description\``);
      else if (fm.description.length < 40) {
        err(`${sLabel}: description too short to be a useful trigger (<40 chars)`);
      }
    }
  }

  // hooks
  const hooksPath = join(pluginDir, "hooks", "hooks.json");
  if (existsSync(hooksPath)) {
    const hooks = readJson(hooksPath, `${label}/hooks`);
    const commands = JSON.stringify(hooks ?? {}).match(/\$\{CLAUDE_PLUGIN_ROOT\}[^"\\]*/g) ?? [];
    for (const c of commands) {
      const rel = c.replace("${CLAUDE_PLUGIN_ROOT}", "");
      if (!existsSync(join(pluginDir, rel))) {
        err(`${label}/hooks: referenced script ${rel} does not exist`);
      }
    }
  }
}

// --- report ---------------------------------------------------------------
if (errors.length) {
  console.error(`✗ validation failed (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ marketplace, plugins, skills, and hooks all valid");
