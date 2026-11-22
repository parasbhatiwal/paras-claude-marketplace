#!/usr/bin/env node
/**
 * Advisory smoke test: does the real Codex CLI accept this repo's marketplace?
 *
 * Nobody on the project can run Codex interactively, so this is the one check
 * that exercises the manifests with the actual tool. It adds the repo as a
 * local marketplace, installs the plugin, and checks what Codex reports and
 * what it put in its plugin cache. It needs no network and no credentials; it
 * runs against a throwaway CODEX_HOME so it never touches a real Codex setup.
 *
 * It checks structure (listed, installed, same version, cache layout, skill
 * count), not the CLI's wording, so a cosmetic change in Codex does not break it.
 *
 * Usage: node scripts/codex-smoke.mjs [--codex <path-to-codex>] [--root <repo>]
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @param {{ codex?: string, root: string, env?: Record<string,string> }} opts
 * @returns {{ ok: boolean, failures: string[], log: string }}
 */
export function runSmoke({ codex = "codex", root, env = {} }) {
  const failures = [];
  const log = [];
  const say = (line) => log.push(line);
  const fail = (msg) => failures.push(msg);

  // What we expect, read from the repo: the Codex marketplace file names the
  // marketplace and plugin; the Claude plugin manifest is the version source.
  const marketPath = join(root, ".agents", "plugins", "marketplace.json");
  if (!existsSync(marketPath)) {
    fail("missing .agents/plugins/marketplace.json, so there is nothing for Codex to add");
    return { ok: false, failures, log: log.join("\n") };
  }
  const market = JSON.parse(readFileSync(marketPath, "utf8"));
  const entry = market.plugins?.[0];
  const sourcePath = typeof entry?.source === "string" ? entry.source : entry?.source?.path;
  if (!market.name || !entry?.name || !sourcePath) {
    fail(".agents/plugins/marketplace.json has no marketplace name, plugin name or source path");
    return { ok: false, failures, log: log.join("\n") };
  }
  const pluginDir = resolve(root, sourcePath);
  const version = JSON.parse(
    readFileSync(join(pluginDir, ".claude-plugin", "plugin.json"), "utf8")
  ).version;
  const skillCount = existsSync(join(pluginDir, "skills"))
    ? readdirSync(join(pluginDir, "skills")).length
    : 0;
  const id = `${entry.name}@${market.name}`;

  // A throwaway home keeps the run away from any real Codex configuration.
  const home = mkdtempSync(join(tmpdir(), "codex-smoke-home-"));
  const codexHome = join(home, ".codex");
  mkdirSync(codexHome, { recursive: true });
  const childEnv = { ...process.env, ...env, HOME: home, CODEX_HOME: codexHome };
  say(`CODEX_HOME=${codexHome}`);

  const codexRun = (...args) =>
    spawnSync(codex, args, { env: childEnv, encoding: "utf8", cwd: root });

  try {
    const v = codexRun("--version");
    if (v.error || v.status !== 0) {
      fail(`could not run \`${codex} --version\`: ${v.error?.message ?? v.stderr.trim()}`);
      return { ok: false, failures, log: log.join("\n") };
    }
    say(v.stdout.trim());

    const add = codexRun("plugin", "marketplace", "add", root);
    say(`plugin marketplace add -> exit ${add.status}`);
    if (add.status !== 0) {
      fail(`plugin marketplace add failed: ${(add.stderr || add.stdout).trim()}`);
      return { ok: false, failures, log: log.join("\n") };
    }

    // Before installing, Codex lists the plugin as available but "not installed".
    const before = codexRun("plugin", "list");
    say(before.stdout.trim());
    // Rows are whitespace-separated columns; match the id as a whole first
    // column so `team-skills@x-fork` is never mistaken for `team-skills@x`.
    const rowFor = (out) => out.split("\n").find((l) => l.trim().split(/\s+/)[0] === id);
    if (before.status !== 0 || !rowFor(before.stdout)) {
      fail(`plugin list does not show ${id} from the marketplace`);
    }

    const install = codexRun("plugin", "add", id);
    say(`plugin add ${id} -> exit ${install.status}`);
    if (install.status !== 0) {
      fail(`plugin add ${id} failed: ${(install.stderr || install.stdout).trim()}`);
      return { ok: failures.length === 0, failures, log: log.join("\n") };
    }

    // After installing it must be installed, at the Claude plugin's version.
    const after = codexRun("plugin", "list");
    const line = rowFor(after.stdout);
    if (!line || /not installed/i.test(line) || !/installed/i.test(line)) {
      fail(`${id} is not reported as installed after plugin add: ${line?.trim() ?? "(not listed)"}`);
    } else if (!line.trim().split(/\s+/).some((t) => t.replace(/,$/, "") === version)) {
      fail(`${id} is installed but not at version ${version} (the Claude plugin version): ${line.trim()}`);
    }

    // Documented layout: <CODEX_HOME>/plugins/cache/<marketplace>/<plugin>/<version>/
    const cache = join(codexHome, "plugins", "cache", market.name, entry.name, version);
    if (!existsSync(cache)) {
      fail(`Codex did not create the documented cache directory ${cache.replace(home, "~")}`);
    } else {
      const installed = existsSync(join(cache, "skills")) ? readdirSync(join(cache, "skills")).length : 0;
      say(`installed skills: ${installed} (repo ships ${skillCount})`);
      if (installed < skillCount) {
        fail(`only ${installed} skills reached the Codex cache but the repo ships ${skillCount}`);
      }
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }

  return { ok: failures.length === 0, failures, log: log.join("\n") };
}

// --- CLI -------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : fallback;
  };
  const root = resolve(arg("--root", join(dirname(fileURLToPath(import.meta.url)), "..")));
  const result = runSmoke({ codex: arg("--codex", "codex"), root });
  console.log(result.log);
  if (!result.ok) {
    for (const f of result.failures) console.error(`::error::${f}`);
    process.exit(1);
  }
  console.log("✓ the Codex CLI accepted the marketplace and installed the plugin");
}
