import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

const SKILL =
  "---\nname: alpha\ndescription: Use this skill when you need a long enough trigger description to pass validation.\n---\n\n# alpha\n";

const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
};

/** A valid single-plugin repo carrying all three tools' manifests. */
function scaffold(root) {
  const pluginDir = join(root, "plugins", "demo");
  writeJson(join(root, ".claude-plugin", "marketplace.json"), {
    name: "demo-market",
    owner: { name: "Demo Owner" },
    plugins: [{ name: "demo", source: "./plugins/demo", description: "d" }],
  });
  writeJson(join(pluginDir, ".claude-plugin", "plugin.json"), {
    name: "demo",
    version: "1.2.3",
    description: "demo plugin",
  });
  mkdirSync(join(pluginDir, "skills", "alpha"), { recursive: true });
  writeFileSync(join(pluginDir, "skills", "alpha", "SKILL.md"), SKILL);

  writeJson(join(pluginDir, "plugin.json"), {
    $schema: CODEX_SCHEMA,
    name: "demo",
    version: "1.2.3",
    description: "demo plugin",
    author: { name: "Demo Owner" },
  });
  writeJson(join(root, ".agents", "plugins", "marketplace.json"), {
    name: "demo-market",
    interface: { displayName: "Demo Market" },
    plugins: [
      {
        name: "demo",
        source: { source: "local", path: "./plugins/demo" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity",
      },
    ],
  });
  writeJson(join(pluginDir, ".cursor-plugin", "plugin.json"), {
    name: "demo",
    version: "1.2.3",
    description: "demo plugin",
    author: { name: "Demo Owner" },
  });
  writeJson(join(root, ".cursor-plugin", "marketplace.json"), {
    name: "demo-market",
    owner: { name: "Demo Owner" },
    plugins: [{ name: "demo", source: "plugins/demo" }],
  });
}

const edit = (root, rel, fn) => {
  const path = join(root, rel);
  const json = JSON.parse(readFileSync(path, "utf8"));
  fn(json);
  writeFileSync(path, JSON.stringify(json, null, 2));
};

const PATHS = {
  codexPlugin: "plugins/demo/plugin.json",
  codexMarket: ".agents/plugins/marketplace.json",
  cursorPlugin: "plugins/demo/.cursor-plugin/plugin.json",
  cursorMarket: ".cursor-plugin/marketplace.json",
  claudePlugin: "plugins/demo/.claude-plugin/plugin.json",
};

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tool-manifests-"));
  scaffold(root);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const errorsMatching = (re) => validate(root).filter((e) => re.test(e));

describe("the real repo", () => {
  test("ships a manifest for every supported tool", () => {
    for (const rel of [
      "plugins/team-skills/plugin.json",
      ".agents/plugins/marketplace.json",
      "plugins/team-skills/.cursor-plugin/plugin.json",
      ".cursor-plugin/marketplace.json",
    ]) {
      assert.ok(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`);
    }
  });

  test("never lets Cursor or Codex auto-load the Claude-format hooks or commands", () => {
    // Codex hooks stay empty (a later ticket decides them). Cursor points at its
    // own hooks file, which replaces default discovery of hooks/hooks.json.
    const codex = JSON.parse(
      readFileSync(join(REPO_ROOT, "plugins/team-skills/plugin.json"), "utf8")
    );
    assert.deepEqual(codex.extensions?.com?.openai?.hooks, {});
    const cursor = JSON.parse(
      readFileSync(join(REPO_ROOT, "plugins/team-skills/.cursor-plugin/plugin.json"), "utf8")
    );
    assert.deepEqual(cursor.commands, []);
    assert.equal(cursor.hooks, "./hooks/cursor-hooks.json");
    const config = JSON.parse(
      readFileSync(join(REPO_ROOT, "plugins/team-skills", cursor.hooks), "utf8")
    );
    assert.equal(config.version, 1);
    assert.ok(Object.keys(config.hooks).length > 0);
  });

  test("every manifest carries the Claude plugin version", () => {
    const claude = JSON.parse(
      readFileSync(join(REPO_ROOT, "plugins/team-skills/.claude-plugin/plugin.json"), "utf8")
    ).version;
    for (const rel of ["plugins/team-skills/plugin.json", "plugins/team-skills/.cursor-plugin/plugin.json"]) {
      assert.equal(JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8")).version, claude, rel);
    }
  });
});

describe("a well-formed repo", () => {
  test("validates clean with all tools' manifests", () => {
    assert.deepEqual(validate(root), []);
  });
});

describe("Codex plugin manifest", () => {
  test("fails without the Agent Plugins schema", () => {
    edit(root, PATHS.codexPlugin, (j) => delete j.$schema);
    assert.equal(errorsMatching(/plugin\.json.*\$schema/).length, 1);
  });

  test("fails on a version that differs from the Claude plugin", () => {
    edit(root, PATHS.codexPlugin, (j) => (j.version = "9.9.9"));
    assert.equal(errorsMatching(/version.*9\.9\.9.*1\.2\.3/).length, 1);
  });

  test("fails on a name that differs from the Claude plugin", () => {
    edit(root, PATHS.codexPlugin, (j) => (j.name = "other"));
    assert.ok(errorsMatching(/plugin\.json.*name/).length >= 1);
  });

  test("fails on a name that breaks Codex's naming rule", () => {
    edit(root, PATHS.codexPlugin, (j) => (j.name = "Bad__Name"));
    assert.ok(errorsMatching(/name.*lowercase/).length >= 1);
  });

  test("fails without a description", () => {
    edit(root, PATHS.codexPlugin, (j) => delete j.description);
    assert.equal(errorsMatching(/plugin\.json.*description/).length, 1);
  });
});

describe("Codex marketplace", () => {
  test("fails without policy.authentication", () => {
    edit(root, PATHS.codexMarket, (j) => delete j.plugins[0].policy.authentication);
    assert.equal(errorsMatching(/policy\.authentication/).length, 1);
  });

  test("fails without policy.installation", () => {
    edit(root, PATHS.codexMarket, (j) => delete j.plugins[0].policy.installation);
    assert.equal(errorsMatching(/policy\.installation/).length, 1);
  });

  test("fails without a category", () => {
    edit(root, PATHS.codexMarket, (j) => delete j.plugins[0].category);
    assert.equal(errorsMatching(/category/).length, 1);
  });

  test("fails when a local source path does not start with ./", () => {
    edit(root, PATHS.codexMarket, (j) => (j.plugins[0].source.path = "plugins/demo"));
    assert.equal(errorsMatching(/must start with `\.\/`/).length, 1);
  });

  test("fails when the source directory does not exist", () => {
    edit(root, PATHS.codexMarket, (j) => (j.plugins[0].source.path = "./plugins/nope"));
    assert.equal(errorsMatching(/does not exist/).length, 1);
  });

  test("accepts a plain-string local source", () => {
    edit(root, PATHS.codexMarket, (j) => (j.plugins[0].source = "./plugins/demo"));
    assert.deepEqual(validate(root), []);
  });

  test("fails when the plugin name differs from the Claude plugin", () => {
    edit(root, PATHS.codexMarket, (j) => (j.plugins[0].name = "other"));
    assert.equal(errorsMatching(/\.agents.*name `other`/).length, 1);
  });

  test("fails when the marketplace name differs from the Claude marketplace", () => {
    edit(root, PATHS.codexMarket, (j) => (j.name = "different"));
    assert.equal(errorsMatching(/marketplace name `different`/).length, 1);
  });
});

describe("Cursor plugin manifest", () => {
  test("fails without a name", () => {
    edit(root, PATHS.cursorPlugin, (j) => delete j.name);
    assert.ok(errorsMatching(/\.cursor-plugin\/plugin\.json.*name/).length >= 1);
  });

  test("fails on a version that differs from the Claude plugin", () => {
    edit(root, PATHS.cursorPlugin, (j) => (j.version = "0.0.1"));
    assert.equal(errorsMatching(/version.*0\.0\.1.*1\.2\.3/).length, 1);
  });

  test("fails when an author has no name", () => {
    edit(root, PATHS.cursorPlugin, (j) => (j.author = { email: "x@example.com" }));
    assert.equal(errorsMatching(/author\.name/).length, 1);
  });
});

describe("Cursor hooks config", () => {
  const HOOKS_PATH = "plugins/demo/hooks/cursor-hooks.json";
  const withHooks = (config = {
    version: 1,
    hooks: {
      beforeShellExecution: [
        { type: "command", command: 'node "${CURSOR_PLUGIN_ROOT}/hooks/guard.mjs"' },
      ],
    },
  }) => {
    mkdirSync(join(root, "plugins/demo/hooks"), { recursive: true });
    writeFileSync(join(root, "plugins/demo/hooks/guard.mjs"), "// guard\n");
    writeJson(join(root, HOOKS_PATH), config);
    edit(root, PATHS.cursorPlugin, (j) => (j.hooks = "./hooks/cursor-hooks.json"));
  };

  test("a valid config whose commands reference existing scripts validates clean", () => {
    withHooks();
    assert.deepEqual(validate(root), []);
  });

  test("fails when the manifest hook path does not exist", () => {
    edit(root, PATHS.cursorPlugin, (j) => (j.hooks = "./hooks/nope.json"));
    assert.equal(errorsMatching(/hooks.*nope\.json.*does not exist/).length, 1);
  });

  test("fails when the manifest hook path escapes the plugin directory", () => {
    edit(root, PATHS.cursorPlugin, (j) => (j.hooks = "../../.cursor-plugin/marketplace.json"));
    assert.equal(errorsMatching(/hooks.*inside the plugin/).length, 1);
  });

  test("fails when the hooks file is not valid JSON", () => {
    withHooks();
    writeFileSync(join(root, HOOKS_PATH), "{ nope");
    assert.equal(errorsMatching(/cursor-hooks\.json.*cannot parse/).length, 1);
  });

  test("fails when the hooks file has no version", () => {
    withHooks({ hooks: {} });
    assert.equal(errorsMatching(/cursor-hooks\.json.*version/).length, 1);
  });

  test("fails when a command references a script that does not exist", () => {
    withHooks({
      version: 1,
      hooks: {
        beforeShellExecution: [
          { type: "command", command: 'node "${CURSOR_PLUGIN_ROOT}/hooks/missing.mjs"' },
        ],
      },
    });
    assert.equal(errorsMatching(/missing\.mjs.*does not exist/).length, 1);
  });

  test("fails when a command does not use the Cursor plugin root variable", () => {
    withHooks({
      version: 1,
      hooks: {
        sessionStart: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"' }],
      },
    });
    assert.equal(errorsMatching(/CURSOR_PLUGIN_ROOT/).length, 1);
  });

  test("fails when a hook entry has no command", () => {
    withHooks({ version: 1, hooks: { sessionStart: [{ type: "command" }] } });
    assert.equal(errorsMatching(/missing `command`/).length, 1);
  });
});

describe("Cursor marketplace", () => {
  test("fails without owner.name", () => {
    edit(root, PATHS.cursorMarket, (j) => delete j.owner);
    assert.equal(errorsMatching(/owner\.name/).length, 1);
  });

  test("fails when the plugin source does not exist", () => {
    edit(root, PATHS.cursorMarket, (j) => (j.plugins[0].source = "plugins/nope"));
    assert.equal(errorsMatching(/does not exist/).length, 1);
  });

  test("fails when the source has no Cursor plugin manifest", () => {
    rmSync(join(root, PATHS.cursorPlugin));
    assert.equal(errorsMatching(/missing .*\.cursor-plugin\/plugin\.json/).length, 1);
  });

  test("fails when metadata.version differs from the Claude plugin", () => {
    edit(root, PATHS.cursorMarket, (j) => (j.metadata = { version: "5.0.0" }));
    assert.equal(errorsMatching(/metadata\.version.*5\.0\.0/).length, 1);
  });

  test("fails when the plugin name differs from the Claude plugin", () => {
    edit(root, PATHS.cursorMarket, (j) => (j.plugins[0].name = "other"));
    assert.equal(errorsMatching(/\.cursor-plugin.*name `other`/).length, 1);
  });

  test("fails when the marketplace name differs from the Claude marketplace", () => {
    edit(root, PATHS.cursorMarket, (j) => (j.name = "different"));
    assert.equal(errorsMatching(/marketplace name `different`/).length, 1);
  });
});

describe("a repo with only Claude manifests", () => {
  test("still validates (tool manifests are checked when present)", () => {
    for (const rel of [PATHS.codexPlugin, PATHS.codexMarket, PATHS.cursorPlugin, PATHS.cursorMarket]) {
      rmSync(join(root, rel));
    }
    assert.deepEqual(validate(root), []);
  });
});
