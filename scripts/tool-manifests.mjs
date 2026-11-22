/**
 * Validates the Codex and Cursor manifests that sit beside the Claude ones.
 *
 * Field rules come from plugins/<name>/references/agent-tool-contracts.md
 * (official OpenAI and Cursor docs). The Claude plugin manifest is the source
 * of truth for name and version: every other manifest must agree with it, so a
 * version bump can never reach one tool and silently skip another.
 *
 * Manifests are checked when present. The repo's own test asserts they all
 * exist, which keeps this module usable on minimal fixture trees.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";

export const CODEX_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

const CODEX_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURSOR_NAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";

/** Reads JSON, reporting a parse failure once; returns null when absent or broken. */
function readJson(path, label, err) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    err(`${label}: cannot parse: ${e.message}`);
    return null;
  }
}

/** Name and version must equal the Claude plugin's, which is the source of truth. */
function checkAgreement(label, manifest, claude, err) {
  if (manifest.name && manifest.name !== claude.name) {
    err(`${label}: name \`${manifest.name}\` != Claude plugin name \`${claude.name}\``);
  }
  if (!manifest.version) {
    err(`${label}: missing \`version\` (must equal the Claude plugin version ${claude.version})`);
  } else if (manifest.version !== claude.version) {
    err(
      `${label}: version \`${manifest.version}\` != Claude plugin version ` +
        `\`${claude.version}\` — every manifest must carry the same version`
    );
  }
  // The license is declared once, in the Claude manifest, and copied everywhere.
  // Nothing is required of the others when the Claude manifest declares none.
  if (claude.license !== undefined && manifest.license !== claude.license) {
    err(
      manifest.license === undefined
        ? `${label}: missing \`license\` (must equal the Claude plugin license \`${claude.license}\`)`
        : `${label}: license \`${manifest.license}\` != Claude plugin license \`${claude.license}\``
    );
  }
}

const CURSOR_ROOT_VAR = "${CURSOR_PLUGIN_ROOT}";

/**
 * The Cursor manifest's `hooks` field: a path (replaces default discovery of the
 * Claude-format hooks/hooks.json) or an inline object. Either way the config
 * needs `version`, and every command must reach an existing script through the
 * Cursor plugin root variable.
 */
function checkCursorHooks({ pluginDir, label, hooks, err }) {
  let config = hooks;
  let where = `${label}: \`hooks\``;
  if (typeof hooks === "string") {
    const file = resolve(pluginDir, hooks);
    where = `${label}: hooks file ${hooks}`;
    if (file !== resolve(pluginDir) && !file.startsWith(resolve(pluginDir) + sep)) {
      err(`${where} must stay inside the plugin directory`);
      return;
    }
    if (!existsSync(file)) {
      err(`${where} does not exist`);
      return;
    }
    config = readJson(file, relative(resolve(pluginDir, ".."), file), err);
    if (config === null) return;
  }
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    err(`${where} must be a path or an object`);
    return;
  }
  if (config.version === undefined) err(`${where}: missing \`version\``);
  if (config.hooks === null || typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
    err(`${where}: \`hooks\` must be an object keyed by event name`);
    return;
  }
  const pluginRoot = resolve(pluginDir);
  for (const [event, entries] of Object.entries(config.hooks)) {
    if (!Array.isArray(entries)) {
      err(`${where}: event ${event} must be an array of hook entries`);
      continue;
    }
    for (const entry of entries) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        err(`${where}: ${event} entry must be an object`);
        continue;
      }
      if (entry.type !== undefined && entry.type !== "command") {
        err(`${where}: ${event} entry \`type\` must be "command" (plugin hooks run command hooks only)`);
      }
      if (!nonEmpty(entry.command)) {
        err(`${where}: ${event} entry missing \`command\``);
        continue;
      }
      const refs = [...entry.command.matchAll(/\$\{CURSOR_PLUGIN_ROOT\}\/([^\s"']+)/g)];
      if (refs.length === 0) {
        err(`${where}: ${event} command must reference a script under ${CURSOR_ROOT_VAR}`);
      }
      for (const [, script] of refs) {
        const target = resolve(pluginRoot, script);
        if (!target.startsWith(pluginRoot + sep)) {
          err(`${where}: ${event} command script ${script} must stay inside the plugin directory`);
        } else if (!existsSync(target)) {
          err(`${where}: ${event} command script ${script} does not exist`);
        }
      }
    }
  }
}

/** Per-plugin manifests: the Codex portable plugin.json and the Cursor plugin.json. */
export function validatePluginManifests({ root, pluginDir, claude, err }) {
  const label = relative(root, pluginDir);

  const codexPath = join(pluginDir, "plugin.json");
  const codex = readJson(codexPath, `${label}/plugin.json`, err);
  if (codex) {
    const l = `${label}/plugin.json`;
    if (codex.$schema !== CODEX_SCHEMA) {
      err(`${l}: \`$schema\` must be ${CODEX_SCHEMA}`);
    }
    if (!nonEmpty(codex.name)) err(`${l}: missing \`name\``);
    else if (!CODEX_NAME.test(codex.name) || codex.name.length > 64) {
      err(`${l}: name \`${codex.name}\` must be lowercase letters, digits and single hyphens, at most 64 characters`);
    }
    if (!nonEmpty(codex.description)) err(`${l}: missing \`description\``);
    checkAgreement(l, codex, claude, err);
  }

  const cursorPath = join(pluginDir, ".cursor-plugin", "plugin.json");
  const cursor = readJson(cursorPath, `${label}/.cursor-plugin/plugin.json`, err);
  if (cursor) {
    const l = `${label}/.cursor-plugin/plugin.json`;
    if (!nonEmpty(cursor.name)) err(`${l}: missing \`name\``);
    else if (!CURSOR_NAME.test(cursor.name)) {
      err(`${l}: name \`${cursor.name}\` must be lowercase kebab-case`);
    }
    if (cursor.author !== undefined && !nonEmpty(cursor.author?.name)) {
      err(`${l}: \`author.name\` is required when \`author\` is present`);
    }
    checkAgreement(l, cursor, claude, err);
    if (cursor.hooks !== undefined) {
      checkCursorHooks({ pluginDir, label: l, hooks: cursor.hooks, err });
    }
  }
}

/** A marketplace entry's source resolves to one of this repo's plugins. */
function resolveSource(root, rawPath, plugins) {
  const dir = resolve(root, rawPath);
  return { dir, plugin: plugins.find((p) => resolve(p.dir) === dir) };
}

/**
 * Repo-level marketplaces: the Codex file under .agents/plugins and the Cursor
 * file under .cursor-plugin. `plugins` is [{ dir, name, version }] taken from
 * the Claude manifests; `claudeMarketplaceName` is the Claude marketplace name.
 */
export function validateMarketplaces({ root, plugins, claudeMarketplaceName, err }) {
  // --- Codex ---------------------------------------------------------------
  const codexLabel = ".agents/plugins/marketplace.json";
  const codex = readJson(join(root, codexLabel), codexLabel, err);
  if (codex) {
    if (!nonEmpty(codex.name)) err(`${codexLabel}: missing \`name\``);
    else if (claudeMarketplaceName && codex.name !== claudeMarketplaceName) {
      err(`${codexLabel}: marketplace name \`${codex.name}\` != Claude marketplace name \`${claudeMarketplaceName}\``);
    }
    if (!Array.isArray(codex.plugins) || codex.plugins.length === 0) {
      err(`${codexLabel}: \`plugins\` must be a non-empty array`);
    } else {
      for (const entry of codex.plugins) {
        const who = entry?.name ?? "?";
        if (!nonEmpty(entry?.name)) err(`${codexLabel}: plugin entry missing \`name\``);
        if (!nonEmpty(entry?.policy?.installation)) {
          err(`${codexLabel}: plugin ${who} missing \`policy.installation\``);
        }
        if (!nonEmpty(entry?.policy?.authentication)) {
          err(`${codexLabel}: plugin ${who} missing \`policy.authentication\``);
        }
        if (!nonEmpty(entry?.category)) err(`${codexLabel}: plugin ${who} missing \`category\``);

        const source = entry?.source;
        const rawPath = typeof source === "string" ? source : source?.path;
        const isLocal = typeof source === "string" || source?.source === "local";
        if (!isLocal) continue; // git and npm sources are not ours to resolve
        if (!nonEmpty(rawPath)) {
          err(`${codexLabel}: plugin ${who} missing a local source path`);
          continue;
        }
        if (!rawPath.startsWith("./")) {
          err(`${codexLabel}: plugin ${who} source path \`${rawPath}\` must start with \`./\``);
          continue;
        }
        const { dir, plugin } = resolveSource(root, rawPath, plugins);
        if (!existsSync(dir)) {
          err(`${codexLabel}: plugin ${who} source ${rawPath} does not exist`);
        } else if (!plugin) {
          err(`${codexLabel}: plugin ${who} source ${rawPath} is not a plugin in this repo`);
        } else if (entry.name !== plugin.name) {
          err(`${codexLabel}: plugin name \`${entry.name}\` != Claude plugin name \`${plugin.name}\``);
        }
      }
    }
  }

  // --- Cursor --------------------------------------------------------------
  const cursorLabel = ".cursor-plugin/marketplace.json";
  const cursor = readJson(join(root, cursorLabel), cursorLabel, err);
  if (cursor) {
    if (!nonEmpty(cursor.name)) err(`${cursorLabel}: missing \`name\``);
    else if (claudeMarketplaceName && cursor.name !== claudeMarketplaceName) {
      err(`${cursorLabel}: marketplace name \`${cursor.name}\` != Claude marketplace name \`${claudeMarketplaceName}\``);
    }
    if (!nonEmpty(cursor.owner?.name)) err(`${cursorLabel}: missing \`owner.name\``);
    if (!Array.isArray(cursor.plugins) || cursor.plugins.length === 0) {
      err(`${cursorLabel}: \`plugins\` must be a non-empty array`);
    } else {
      for (const entry of cursor.plugins) {
        const who = entry?.name ?? "?";
        if (!nonEmpty(entry?.name)) err(`${cursorLabel}: plugin entry missing \`name\``);
        const rawPath = typeof entry?.source === "string" ? entry.source : entry?.source?.path;
        if (!nonEmpty(rawPath)) {
          err(`${cursorLabel}: plugin ${who} missing \`source\``);
          continue;
        }
        const { dir, plugin } = resolveSource(root, rawPath, plugins);
        if (!existsSync(dir)) {
          err(`${cursorLabel}: plugin ${who} source ${rawPath} does not exist`);
          continue;
        }
        if (!existsSync(join(dir, ".cursor-plugin", "plugin.json"))) {
          err(`${cursorLabel}: plugin ${who} source ${rawPath} is missing .cursor-plugin/plugin.json`);
        }
        if (!plugin) {
          err(`${cursorLabel}: plugin ${who} source ${rawPath} is not a plugin in this repo`);
          continue;
        }
        if (entry.name && entry.name !== plugin.name) {
          err(`${cursorLabel}: plugin name \`${entry.name}\` != Claude plugin name \`${plugin.name}\``);
        }
        for (const [where, version] of [
          ["plugin entry version", entry.version],
          ["metadata.version", cursor.metadata?.version],
        ]) {
          if (version !== undefined && version !== plugin.version) {
            err(`${cursorLabel}: ${where} \`${version}\` != Claude plugin version \`${plugin.version}\``);
          }
        }
      }
    }
  }
}
