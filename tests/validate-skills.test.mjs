import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Builds a minimal well-formed marketplace on disk, then applies overrides. */
function scaffold(root, { skills = {}, marketplace, plugin } = {}) {
  const pluginDir = join(root, "plugins", "demo");
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  mkdirSync(join(pluginDir, ".claude-plugin"), { recursive: true });

  writeFileSync(
    join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify(
      marketplace ?? {
        name: "demo-market",
        owner: { name: "Demo Owner" },
        plugins: [{ name: "demo", source: "./plugins/demo", description: "d" }],
      }
    )
  );
  writeFileSync(
    join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(plugin ?? { name: "demo", version: "1.0.0", description: "demo plugin" })
  );

  for (const [name, body] of Object.entries(skills)) {
    const dir = join(pluginDir, "skills", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), body);
  }
  return pluginDir;
}

const skill = (name, body = "Do the thing.") =>
  `---\nname: ${name}\ndescription: Use this skill when you need a long enough trigger description to pass validation.\n---\n\n# ${name}\n\n${body}\n`;

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "marketplace-test-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the real repo", () => {
  test("validates clean", () => {
    assert.deepEqual(validate(REPO_ROOT), []);
  });
});

describe("marketplace manifest", () => {
  test("accepts a well-formed marketplace", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    assert.deepEqual(validate(root), []);
  });

  test("rejects a placeholder owner", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha") },
      marketplace: {
        name: "demo-market",
        owner: { name: "Your Org" },
        plugins: [{ name: "demo", source: "./plugins/demo" }],
      },
    });
    assert.match(validate(root).join("\n"), /placeholder/);
  });

  test("rejects a missing owner", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha") },
      marketplace: { name: "demo-market", plugins: [{ name: "demo", source: "./plugins/demo" }] },
    });
    assert.match(validate(root).join("\n"), /missing `owner.name`/);
  });

  test("rejects a name mismatch between marketplace and plugin.json", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha") },
      marketplace: {
        name: "demo-market",
        owner: { name: "Demo Owner" },
        plugins: [{ name: "renamed", source: "./plugins/demo" }],
      },
    });
    assert.match(validate(root).join("\n"), /names must match/);
  });

  test("rejects a non-semver plugin version", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha") },
      plugin: { name: "demo", version: "v1", description: "demo plugin" },
    });
    assert.match(validate(root).join("\n"), /must be semver/);
  });

  test("rejects a source path that does not exist", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha") },
      marketplace: {
        name: "demo-market",
        owner: { name: "Demo Owner" },
        plugins: [{ name: "demo", source: "./plugins/ghost" }],
      },
    });
    assert.match(validate(root).join("\n"), /does not exist/);
  });
});

describe("skill frontmatter", () => {
  test("rejects a name that disagrees with its directory", () => {
    scaffold(root, { skills: { alpha: skill("beta") } });
    assert.match(validate(root).join("\n"), /!= directory/);
  });

  test("rejects a too-short description", () => {
    scaffold(root, {
      skills: { alpha: "---\nname: alpha\ndescription: too short\n---\n\n# alpha\n" },
    });
    assert.match(validate(root).join("\n"), /description too short/);
  });

  test("rejects a description longer than the listing budget", () => {
    scaffold(root, {
      skills: { alpha: `---\nname: alpha\ndescription: ${"x".repeat(1100)}\n---\n\n# alpha\n` },
    });
    assert.match(validate(root).join("\n"), /description too long/);
  });

  test("rejects missing frontmatter", () => {
    scaffold(root, { skills: { alpha: "# alpha\n\nno frontmatter here\n" } });
    assert.match(validate(root).join("\n"), /missing YAML frontmatter/);
  });
});

describe("cross-references", () => {
  test("accepts a reference to a sibling skill", () => {
    scaffold(root, {
      alpha: undefined,
      skills: {
        alpha: skill("alpha", "Then run the `beta` skill."),
        beta: skill("beta"),
      },
    });
    assert.deepEqual(validate(root), []);
  });

  test("rejects a reference to a skill that does not exist", () => {
    scaffold(root, { skills: { alpha: skill("alpha", "Then run the `ghost` skill.") } });
    assert.match(validate(root).join("\n"), /references skill `ghost`, which does not exist/);
  });

  test("accepts references to built-in Claude Code skills", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha", "Run the `/code-review` skill, then `/security-review`.") },
    });
    assert.deepEqual(validate(root), []);
  });

  test("rejects a bundled file reference that does not resolve", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha", "See `../../references/missing.md` for setup.") },
    });
    assert.match(validate(root).join("\n"), /references bundled file/);
  });

  test("accepts a bundled file reference that resolves", () => {
    const pluginDir = scaffold(root, {
      skills: { alpha: skill("alpha", "See `../../references/setup.md` for setup.") },
    });
    mkdirSync(join(pluginDir, "references"), { recursive: true });
    writeFileSync(join(pluginDir, "references", "setup.md"), "# setup\n");
    assert.deepEqual(validate(root), []);
  });

  test("ignores project-relative paths that are not plugin references", () => {
    scaffold(root, {
      skills: { alpha: skill("alpha", "Look for `package.json` and `vitest.config.mts`.") },
    });
    assert.deepEqual(validate(root), []);
  });
});

describe("commands", () => {
  const writeCommand = (pluginDir, name, contents) => {
    mkdirSync(join(pluginDir, "commands"), { recursive: true });
    writeFileSync(join(pluginDir, "commands", name), contents);
  };

  test("accepts a command that invokes an existing skill", () => {
    const pluginDir = scaffold(root, { skills: { alpha: skill("alpha") } });
    writeCommand(pluginDir, "go.md", "---\ndescription: Run alpha\n---\n\nRun the `alpha` skill.\n");
    assert.deepEqual(validate(root), []);
  });

  test("rejects a command with no description", () => {
    const pluginDir = scaffold(root, { skills: { alpha: skill("alpha") } });
    writeCommand(pluginDir, "go.md", "---\nargument-hint: [x]\n---\n\nRun the `alpha` skill.\n");
    assert.match(validate(root).join("\n"), /commands\/go\.md: frontmatter missing/);
  });

  test("rejects a command pointing at a skill that does not exist", () => {
    const pluginDir = scaffold(root, { skills: { alpha: skill("alpha") } });
    writeCommand(pluginDir, "go.md", "---\ndescription: Run ghost\n---\n\nRun the `ghost` skill.\n");
    assert.match(validate(root).join("\n"), /references skill `ghost`/);
  });
});

describe("repo-level skills (.claude/skills)", () => {
  const writeRepoSkill = (name, body) => {
    const dir = join(root, ".claude", "skills", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), body);
  };

  test("accepts a well-formed repo-level skill", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    writeRepoSkill("ship-it", skill("ship-it"));
    assert.deepEqual(validate(root), []);
  });

  test("holds it to the same frontmatter bar as shipped skills", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    writeRepoSkill("ship-it", skill("wrong-name"));
    assert.match(validate(root).join("\n"), /\.claude\/skills\/ship-it: frontmatter name/);
  });

  test("can reference a plugin skill", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    writeRepoSkill("ship-it", skill("ship-it", "Use the `alpha` skill to verify."));
    assert.deepEqual(validate(root), []);
  });

  test("rejects a reference to a skill that does not exist", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    writeRepoSkill("ship-it", skill("ship-it", "Use the `ghost` skill."));
    assert.match(validate(root).join("\n"), /references skill `ghost`/);
  });

  test("is silent when the repo has no .claude/skills directory", () => {
    scaffold(root, { skills: { alpha: skill("alpha") } });
    assert.deepEqual(validate(root), []);
  });
});

describe("hooks", () => {
  test("rejects a hooks.json pointing at a missing script", () => {
    const pluginDir = scaffold(root, { skills: { alpha: skill("alpha") } });
    mkdirSync(join(pluginDir, "hooks"), { recursive: true });
    writeFileSync(
      join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/ghost.mjs"' }],
            },
          ],
        },
      })
    );
    assert.match(validate(root).join("\n"), /referenced script .* does not exist/);
  });
});
