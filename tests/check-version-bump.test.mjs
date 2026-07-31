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
