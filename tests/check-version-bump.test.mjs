import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { pluginsNeedingBump, checkBumps } from "../scripts/check-version-bump.mjs";

const versions = (base, head) => (_pluginDir, side) => (side === "base" ? base : head);

describe("pluginsNeedingBump", () => {
  test("flags skill and hook changes", () => {
    assert.deepEqual(
      pluginsNeedingBump([
        "plugins/team-skills/skills/implement/SKILL.md",
        "plugins/team-skills/hooks/policy.mjs",
      ]),
      ["plugins/team-skills"]
    );
  });

  test("ignores docs, examples, and CI changes", () => {
    assert.deepEqual(
      pluginsNeedingBump(["README.md", "examples/ONBOARDING.md", ".github/workflows/validate.yml"]),
      []
    );
  });

  test("reports each affected plugin once", () => {
    assert.deepEqual(
      pluginsNeedingBump([
        "plugins/a/skills/x/SKILL.md",
        "plugins/a/skills/y/SKILL.md",
        "plugins/b/hooks/h.mjs",
      ]),
      ["plugins/a", "plugins/b"]
    );
  });
});

describe("checkBumps", () => {
  test("passes when the version was bumped", () => {
    const errors = checkBumps(
      ["plugins/team-skills/skills/implement/SKILL.md"],
      versions("0.2.0", "0.3.0")
    );
    assert.deepEqual(errors, []);
  });

  test("fails when skills changed but the version did not", () => {
    const errors = checkBumps(
      ["plugins/team-skills/skills/implement/SKILL.md"],
      versions("0.2.0", "0.2.0")
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /still 0\.2\.0/);
  });

  test("passes for a brand-new plugin with no base version", () => {
    const errors = checkBumps(["plugins/new/skills/x/SKILL.md"], versions(null, "0.1.0"));
    assert.deepEqual(errors, []);
  });

  test("passes when nothing executable changed", () => {
    assert.deepEqual(checkBumps(["README.md"], versions("0.2.0", "0.2.0")), []);
  });
});

describe("tool manifests count as plugin changes", () => {
  const plugin = ["plugins/team-skills"];

  for (const file of [
    "plugins/team-skills/plugin.json",
    "plugins/team-skills/.cursor-plugin/plugin.json",
  ]) {
    test(`flags ${file}`, () => {
      assert.deepEqual(pluginsNeedingBump([file], plugin), ["plugins/team-skills"]);
    });
  }

  for (const file of [".agents/plugins/marketplace.json", ".cursor-plugin/marketplace.json"]) {
    test(`flags every plugin when ${file} changes`, () => {
      assert.deepEqual(pluginsNeedingBump([file], ["plugins/a", "plugins/b"]), [
        "plugins/a",
        "plugins/b",
      ]);
    });
  }

  test("a root marketplace change flags nothing when no plugins are known", () => {
    assert.deepEqual(pluginsNeedingBump([".agents/plugins/marketplace.json"]), []);
  });

  test("does not flag the Claude manifest itself (that is the bump)", () => {
    assert.deepEqual(
      pluginsNeedingBump(["plugins/team-skills/.claude-plugin/plugin.json"], plugin),
      []
    );
  });

  test("fails when a Cursor manifest changed but the version did not", () => {
    const errors = checkBumps(
      ["plugins/team-skills/.cursor-plugin/plugin.json"],
      versions("1.0.0", "1.0.0"),
      plugin
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /still 1\.0\.0/);
  });

  test("passes when a root marketplace changed and the version moved", () => {
    assert.deepEqual(
      checkBumps([".agents/plugins/marketplace.json"], versions("1.0.0", "1.1.0"), plugin),
      []
    );
  });
});

