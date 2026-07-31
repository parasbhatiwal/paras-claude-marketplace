#!/usr/bin/env node
/**
 * Validates the marketplace repo before anything ships to the team:
 *  - .claude-plugin/marketplace.json parses + required fields + plugin sources exist
 *  - marketplace plugin entries agree with the plugin's own plugin.json name
 *  - each plugin has a valid .claude-plugin/plugin.json (name, version, description)
 *  - every skills/<name>/SKILL.md has YAML frontmatter with `name` and a
 *    non-trivial `description`, and `name` matches its directory
 *  - skills that reference another skill reference one that EXISTS
 *  - skills that reference a bundled file (`./x` or `../x`) reference one that EXISTS
 *  - hooks.json (if present) parses and referenced hook scripts exist
 *
 * `validate(root)` is exported for tests; running the file executes it against
 * the repo root and exits non-zero with a readable error list on any failure.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Skills shipped by Claude Code itself — always valid reference targets. */
const BUILTIN_SKILLS = new Set([
  "code-review",
  "security-review",
  "review",
  "simplify",
  "run",
  "init",
  "brainstorming",
]);

const MIN_DESCRIPTION = 40;
// Claude Code truncates very long skill descriptions in the skill listing.
const MAX_DESCRIPTION = 1024;
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validate(root) {
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

  // --- marketplace.json ----------------------------------------------------
  const mpPath = join(root, ".claude-plugin", "marketplace.json");
  if (!existsSync(mpPath)) err("missing .claude-plugin/marketplace.json");
  const marketplace = existsSync(mpPath) ? readJson(mpPath, "marketplace") : null;

  const pluginDirs = [];
  if (marketplace) {
    if (!marketplace.name) err("marketplace.json: missing `name`");
    if (!marketplace.owner?.name) err("marketplace.json: missing `owner.name`");
    else if (/your org|your name|todo|placeholder/i.test(marketplace.owner.name)) {
      err(`marketplace.json: \`owner.name\` is still a placeholder ("${marketplace.owner.name}")`);
    }
    if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
      err("marketplace.json: `plugins` must be a non-empty array");
    } else {
      for (const p of marketplace.plugins) {
        if (!p.name) err("marketplace.json: plugin entry missing `name`");
        if (!p.source) {
          err(`marketplace.json: plugin ${p.name ?? "?"} missing \`source\``);
        } else if (typeof p.source === "string") {
          const dir = join(root, p.source);
          if (!existsSync(dir)) err(`marketplace.json: source ${p.source} does not exist`);
          else pluginDirs.push({ dir, declaredName: p.name });
        }
      }
    }
  }

  // --- each plugin ---------------------------------------------------------
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

  for (const { dir: pluginDir, declaredName } of pluginDirs) {
    const label = pluginDir.replace(root + "/", "");
    const manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
    if (!existsSync(manifestPath)) {
      err(`${label}: missing .claude-plugin/plugin.json`);
    } else {
      const manifest = readJson(manifestPath, label);
      if (manifest) {
        for (const field of ["name", "version", "description"]) {
          if (!manifest[field]) err(`${label}/plugin.json: missing \`${field}\``);
        }
        if (manifest.name && declaredName && manifest.name !== declaredName) {
          err(
            `marketplace.json lists plugin \`${declaredName}\` but ${label}/plugin.json ` +
              `declares \`${manifest.name}\` — the names must match`
          );
        }
        if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
          err(`${label}/plugin.json: \`version\` must be semver, got \`${manifest.version}\``);
        }
      }
    }

    // skills — pass 1: collect names so cross-references can be checked
    const skillsDir = join(pluginDir, "skills");
    const skills = [];
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
        skills.push({ entry, dir, skillPath, sLabel, raw: readFileSync(skillPath, "utf8") });
      }
    }
    const known = new Set([...skills.map((s) => s.entry), ...BUILTIN_SKILLS]);

    // skills — pass 2: validate each
    for (const { entry, dir, sLabel, raw } of skills) {
      const fm = parseFrontmatter(raw, sLabel);
      if (!fm.name) err(`${sLabel}: frontmatter missing \`name\``);
      else if (fm.name !== entry) {
        err(`${sLabel}: frontmatter name \`${fm.name}\` != directory \`${entry}\``);
      } else if (!SKILL_NAME.test(fm.name)) {
        err(`${sLabel}: name \`${fm.name}\` must be lowercase kebab-case`);
      }

      if (!fm.description) err(`${sLabel}: frontmatter missing \`description\``);
      else if (fm.description.length < MIN_DESCRIPTION) {
        err(`${sLabel}: description too short to be a useful trigger (<${MIN_DESCRIPTION} chars)`);
      } else if (fm.description.length > MAX_DESCRIPTION) {
        err(`${sLabel}: description too long (>${MAX_DESCRIPTION} chars) — it is loaded eagerly`);
      }

      const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");

      // cross-referenced skills must exist: "`x` skill" / "skill `x`"
      const refs = new Set();
      for (const m of body.matchAll(/`\/?([a-z][a-z0-9-]{2,})`\s+skill\b/g)) refs.add(m[1]);
      for (const m of body.matchAll(/\bskills?\s+`\/?([a-z][a-z0-9-]{2,})`/g)) refs.add(m[1]);
      for (const ref of refs) {
        if (ref !== entry && !known.has(ref)) {
          err(`${sLabel}: references skill \`${ref}\`, which does not exist`);
        }
      }

      // bundled file references (explicitly plugin-relative) must exist
      for (const m of body.matchAll(/`(\.{1,2}\/[^`\s]+)`/g)) {
        if (!existsSync(resolve(dir, m[1]))) {
          err(`${sLabel}: references bundled file \`${m[1]}\`, which does not exist`);
        }
      }
    }

    // commands — thin entry points, but a broken one is invisible until a
    // developer types it, so hold them to the same bar as skills
    const commandsDir = join(pluginDir, "commands");
    if (existsSync(commandsDir)) {
      for (const file of readdirSync(commandsDir)) {
        if (!file.endsWith(".md")) continue;
        const cLabel = `${label}/commands/${file}`;
        const raw = readFileSync(join(commandsDir, file), "utf8");
        const fm = parseFrontmatter(raw, cLabel);
        if (!fm.description) err(`${cLabel}: frontmatter missing \`description\``);
        const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
        for (const m of body.matchAll(/`\/?([a-z][a-z0-9-]{2,})`\s+skill\b/g)) {
          if (!known.has(m[1])) {
            err(`${cLabel}: references skill \`${m[1]}\`, which does not exist`);
          }
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

  return errors;
}

// --- CLI -------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const errors = validate(root);
  if (errors.length) {
    console.error(`✗ validation failed (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("✓ marketplace, plugins, skills, and hooks all valid");
}
