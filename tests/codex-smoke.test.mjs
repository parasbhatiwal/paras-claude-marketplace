import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSmoke } from "../scripts/codex-smoke.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A stand-in `codex` that behaves like the real one did when run by hand
 * (0.171.0): marketplace add and list succeed, plugin list reports the plugin
 * as installed with its version, and plugin add populates the documented cache
 * path with the plugin's skills. FAKE_MODE breaks one thing at a time.
 */
const FAKE_CODEX = `#!/bin/sh
mode="\${FAKE_MODE:-ok}"
cache="$CODEX_HOME/plugins/cache/$FAKE_MARKET/$FAKE_PLUGIN/$FAKE_VERSION"
case "$*" in
  "--version") echo "codex-cli 9.9.9" ;;
  "plugin marketplace add "*)
    [ "$mode" = "add-fails" ] && { echo "boom" >&2; exit 1; }
    echo "Added marketplace" ;;
  "plugin list")
    [ "$mode" = "no-plugin" ] && { echo "Marketplace \`$FAKE_MARKET\`"; exit 0; }
    [ "$mode" = "similar-id" ] && echo "$FAKE_PLUGIN@$FAKE_MARKET-fork  installed, enabled  9.9.9"
    if [ -d "$cache" ] && [ "$mode" != "not-installed" ]; then
      v="$FAKE_VERSION"; [ "$mode" = "wrong-version" ] && v="0.0.1"
      [ "$mode" = "longer-version" ] && v="\${FAKE_VERSION}0"
      echo "$FAKE_PLUGIN@$FAKE_MARKET  installed, enabled  $v"
    else
      echo "$FAKE_PLUGIN@$FAKE_MARKET  not installed"
    fi ;;
  "plugin add "*)
    [ "$mode" = "install-fails" ] && { echo "nope" >&2; exit 1; }
    mkdir -p "$cache"
    if [ "$mode" != "no-cache" ]; then
      cp -R "$FAKE_SKILLS" "$cache/skills"
      [ "$mode" = "few-skills" ] && rm -rf "$cache/skills/beta"
    fi
    echo "Added plugin" ;;
  *) echo "unexpected: $*" >&2; exit 2 ;;
esac
`;

let work;
let root;
let codex;

const w = (rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "codex-smoke-"));
  root = join(work, "repo");
  w(
    ".agents/plugins/marketplace.json",
    JSON.stringify({
      name: "demo-market",
      plugins: [
        {
          name: "demo",
          source: { source: "local", path: "./plugins/demo" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    })
  );
  w("plugins/demo/.claude-plugin/plugin.json", JSON.stringify({ name: "demo", version: "1.2.3", description: "d" }));
  w("plugins/demo/skills/alpha/SKILL.md", "---\nname: alpha\n---\n");
  w("plugins/demo/skills/beta/SKILL.md", "---\nname: beta\n---\n");

  codex = join(work, "codex");
  writeFileSync(codex, FAKE_CODEX);
  chmodSync(codex, 0o755);
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

const run = (mode = "ok") =>
  runSmoke({
    codex,
    root,
    env: {
      FAKE_MODE: mode,
      FAKE_MARKET: "demo-market",
      FAKE_PLUGIN: "demo",
      FAKE_VERSION: "1.2.3",
      FAKE_SKILLS: join(root, "plugins/demo/skills"),
    },
  });

describe("runSmoke", () => {
  test("passes when the CLI adds the marketplace and installs the plugin", () => {
    const r = run();
    assert.deepEqual(r.failures, []);
    assert.equal(r.ok, true);
  });

  test("reports the CLI version it ran against", () => {
    assert.match(run().log, /codex-cli 9\.9\.9/);
  });

  test("fails when the marketplace cannot be added", () => {
    const r = run("add-fails");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /marketplace add/);
  });

  test("fails when the plugin is not listed from the marketplace", () => {
    const r = run("no-plugin");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /demo@demo-market/);
  });

  test("fails when the CLI reports a different version than the manifest", () => {
    const r = run("wrong-version");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /version.*1\.2\.3/);
  });

  test("fails when the plugin is still reported as not installed after plugin add", () => {
    const r = run("not-installed");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /not reported as installed/);
  });

  test("reads the row for this exact plugin id, not a similarly named one", () => {
    assert.equal(run("similar-id").ok, true);
  });

  test("does not accept a longer version that merely contains the expected one", () => {
    const r = run("longer-version");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /version/);
  });

  test("records the CLI version in its output so a failure can be attributed", () => {
    assert.match(run().log, /codex-cli 9\.9\.9/);
  });

  test("fails when the plugin cannot be installed", () => {
    const r = run("install-fails");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /plugin add/);
  });

  test("fails when the documented cache directory is not created", () => {
    const r = run("no-cache");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /cache/);
  });

  test("fails when fewer skills are installed than the repo ships", () => {
    const r = run("few-skills");
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /1 skills.*2/);
  });

  test("never touches the real home directory: it uses a throwaway CODEX_HOME", () => {
    const before = process.env.CODEX_HOME;
    run();
    assert.equal(process.env.CODEX_HOME, before);
    assert.match(run().log, /CODEX_HOME=.*codex-smoke/);
  });

  test("reports a missing Codex marketplace file instead of crashing", () => {
    rmSync(join(root, ".agents"), { recursive: true });
    const r = run();
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /\.agents\/plugins\/marketplace\.json/);
  });

  test("reports a missing codex binary", () => {
    const r = runSmoke({ codex: join(work, "nope"), root, env: {} });
    assert.equal(r.ok, false);
    assert.match(r.failures.join("\n"), /could not run/);
  });
});

describe("the CI workflow", () => {
  const wf = readFileSync(join(REPO_ROOT, ".github/workflows/codex-smoke.yml"), "utf8");

  test("exists as its own workflow, separate from validate", () => {
    assert.match(wf, /^name:\s*codex-smoke/m);
    assert.ok(existsSync(join(REPO_ROOT, ".github/workflows/validate.yml")));
    const validate = readFileSync(join(REPO_ROOT, ".github/workflows/validate.yml"), "utf8");
    assert.doesNotMatch(validate, /codex/i);
  });

  test("runs on pull requests and on demand", () => {
    assert.match(wf, /pull_request/);
    assert.match(wf, /workflow_dispatch/);
  });

  test("installs the CLI only inside the job, into a temp prefix", () => {
    assert.match(wf, /npm install[^\n]*--prefix[^\n]*@openai\/codex/);
    assert.match(wf, /RUNNER_TEMP/);
  });

  test("uses no secrets and read-only permissions", () => {
    assert.doesNotMatch(wf, /secrets\./);
    assert.match(wf, /permissions:\s*\n\s*contents:\s*read/);
  });

  test("runs the smoke script against the checked-out repo", () => {
    assert.match(wf, /node scripts\/codex-smoke\.mjs/);
  });
});

describe("the repo's own zero-dependency flow", () => {
  test("package.json gained no dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies, undefined);
  });
});

describe("the real repo against the real CLI contract", () => {
  test("the smoke script finds the Codex marketplace, plugin and version it will check", () => {
    const market = JSON.parse(readFileSync(join(REPO_ROOT, ".agents/plugins/marketplace.json"), "utf8"));
    assert.equal(market.plugins[0].name, "team-skills");
    assert.ok(existsSync(join(REPO_ROOT, "plugins/team-skills/skills")));
  });
});
