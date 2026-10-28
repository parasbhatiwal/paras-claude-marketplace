import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

import { nextMinor, disallowedPaths, hasPluginChanges } from "../scripts/upstream-guard.mjs";
import { releaseNeeded } from "../scripts/release-needed.mjs";

describe("nextMinor", () => {
  test("bumps the minor and resets the patch", () => {
    assert.equal(nextMinor("2.0.0"), "2.1.0");
    assert.equal(nextMinor("2.3.7"), "2.4.0");
  });
  test("rejects a version it cannot parse rather than inventing one", () => {
    assert.throws(() => nextMinor("two"));
  });
});

describe("disallowedPaths — what an upstream-driven agent may not touch", () => {
  test("allows skills, references, commands, notices, docs, baseline and the manifest", () => {
    assert.deepEqual(
      disallowedPaths([
        "plugins/team-skills/skills/triage/SKILL.md",
        "plugins/team-skills/references/agent-brief.md",
        "plugins/team-skills/commands/go.md",
        "plugins/team-skills/THIRD_PARTY_NOTICES.md",
        "plugins/team-skills/.claude-plugin/plugin.json",
        "CHANGELOG.md",
        "README.md",
        "upstream.json",
      ]),
      []
    );
  });

  test("blocks the guard hooks, scripts, tests, workflows and repo-level skills", () => {
    const bad = [
      "plugins/team-skills/hooks/policy.mjs",
      "plugins/team-skills/hooks/hooks.json",
      "scripts/validate-skills.mjs",
      "tests/policy.test.mjs",
      ".github/workflows/validate.yml",
      ".claude/skills/ship-change/SKILL.md",
      "examples/githooks/pre-push",
      "package.json",
    ];
    assert.deepEqual(disallowedPaths(bad), bad);
  });

  test("blocks path tricks that resolve outside the allowed prefixes", () => {
    assert.equal(disallowedPaths(["plugins/team-skills/skills/../hooks/policy.mjs"]).length, 1);
  });
});

describe("hasPluginChanges", () => {
  test("is false when only the pre-made version bump and changelog moved", () => {
    assert.equal(
      hasPluginChanges(["plugins/team-skills/.claude-plugin/plugin.json", "CHANGELOG.md", "upstream.json"]),
      false
    );
  });
  test("is true when any skill, reference or command moved", () => {
    assert.equal(hasPluginChanges(["plugins/team-skills/skills/triage/SKILL.md"]), true);
  });
});

describe("releaseNeeded", () => {
  let repo;
  const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
  const setVersion = (v) => {
    mkdirSync(join(repo, "plugins/team-skills/.claude-plugin"), { recursive: true });
    writeFileSync(
      join(repo, "plugins/team-skills/.claude-plugin/plugin.json"),
      JSON.stringify({ name: "team-skills", version: v, description: "x" })
    );
    git("add", "-A");
    git("-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", `v${v}`);
  };

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "release-"));
    git("init", "-q", "-b", "main");
    git("config", "user.name", "t");
    git("config", "user.email", "t@example.com");
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  test("releases when main's plugin version is ahead of stable", () => {
    setVersion("2.0.0");
    git("branch", "stable");
    setVersion("2.1.0");
    assert.equal(releaseNeeded(repo, "stable", "main").release, true);
  });

  test("does not release when the version did not move — the silent-failure case", () => {
    setVersion("2.0.0");
    git("branch", "stable");
    writeFileSync(join(repo, "x.md"), "docs");
    git("add", "-A");
    git("-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", "docs");
    const r = releaseNeeded(repo, "stable", "main");
    assert.equal(r.release, false);
    assert.match(r.reason, /version/i);
  });

  test("refuses when stable is not an ancestor of main (a fast-forward is impossible)", () => {
    setVersion("2.0.0");
    git("branch", "stable");
    git("checkout", "-q", "stable");
    setVersion("2.0.1");
    git("checkout", "-q", "main");
    setVersion("2.1.0");
    const r = releaseNeeded(repo, "stable", "main");
    assert.equal(r.release, false);
    assert.match(r.reason, /fast-forward/i);
  });
});
