import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assessContextFreshness,
  parseFingerprint,
  renderNotice,
  isStructural,
  COMMIT_DRIFT_THRESHOLD,
} from "../plugins/team-skills/hooks/context-freshness.mjs";

const SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const managed = (sha = SHA, generated = "2026-07-01") =>
  `# Project\n\n<!-- claude-context:begin -->\n<!-- claude-context: sha=${sha} generated=${generated} -->\n\n## What this is\n…\n<!-- claude-context:end -->\n`;

const NOW = new Date("2026-07-31T00:00:00Z");
const assess = (facts) => assessContextFreshness({ now: NOW, ...facts });

describe("parseFingerprint", () => {
  test("reads sha and generated date", () => {
    assert.deepEqual(parseFingerprint(managed()), { sha: SHA, generated: "2026-07-01" });
  });

  test("accepts a short sha and a missing date", () => {
    assert.deepEqual(parseFingerprint("<!-- claude-context: sha=a1b2c3d -->"), {
      sha: "a1b2c3d",
      generated: null,
    });
  });

  test("returns null for an unmanaged file", () => {
    assert.equal(parseFingerprint("# Project\n\nhand written\n"), null);
    assert.equal(parseFingerprint(null), null);
  });
});

describe("isStructural", () => {
  test("flags build, dependency, CI, and migration changes", () => {
    for (const f of [
      "package.json",
      "pnpm-lock.yaml",
      "pyproject.toml",
      "go.mod",
      "tsconfig.json",
      "vitest.config.ts",
      "Dockerfile",
      "docker-compose.yml",
      ".github/workflows/ci.yml",
      "db/migrations/001_init.sql",
      "docs/adr/0003-outbox.md",
    ]) {
      assert.equal(isStructural(f), true, `${f} should be structural`);
    }
  });

  test("ignores ordinary source and test churn", () => {
    for (const f of ["src/billing/domain/order.ts", "src/app.test.ts", "README.md"]) {
      assert.equal(isStructural(f), false, `${f} should not be structural`);
    }
  });

  test("does not treat CLAUDE.md itself as structural", () => {
    // The commit writing CLAUDE.md always lands after the sha it records, so
    // counting it would make every freshly generated context instantly stale.
    assert.equal(isStructural("CLAUDE.md"), false);
  });
});

describe("assessContextFreshness", () => {
  test("reports missing when there is no CLAUDE.md", () => {
    const v = assess({ claudeMd: null });
    assert.equal(v.status, "missing");
    assert.match(v.action, /project-context/);
  });

  test("treats an empty CLAUDE.md as missing", () => {
    assert.equal(assess({ claudeMd: "   \n" }).status, "missing");
  });

  test("reports unmanaged when the fingerprint is absent", () => {
    const v = assess({ claudeMd: "# Project\n\nhand written notes\n" });
    assert.equal(v.status, "unmanaged");
    assert.match(v.reasons[0], /no claude-context fingerprint/);
  });

  test("is fresh right after generation", () => {
    const v = assess({ claudeMd: managed(SHA, "2026-07-30"), commitsSince: 0, changedFiles: [] });
    assert.deepEqual(v, { status: "fresh", reasons: [], action: null });
  });

  test("stays fresh under ordinary churn", () => {
    const v = assess({
      claudeMd: managed(SHA, "2026-07-30"),
      commitsSince: 12,
      changedFiles: ["src/a.ts", "src/a.test.ts"],
    });
    assert.equal(v.status, "fresh");
  });

  test("goes stale once commits pile up", () => {
    const v = assess({
      claudeMd: managed(SHA, "2026-07-30"),
      commitsSince: COMMIT_DRIFT_THRESHOLD,
      changedFiles: [],
    });
    assert.equal(v.status, "stale");
    assert.match(v.reasons[0], /commits since/);
  });

  test("goes stale on a structural change regardless of commit count", () => {
    const v = assess({
      claudeMd: managed(SHA, "2026-07-30"),
      commitsSince: 1,
      changedFiles: ["src/a.ts", "package.json"],
    });
    assert.equal(v.status, "stale");
    assert.match(v.reasons.join(" "), /package\.json/);
  });

  test("summarizes long structural change lists", () => {
    const v = assess({
      claudeMd: managed(SHA, "2026-07-30"),
      changedFiles: [
        "package.json",
        "tsconfig.json",
        "Dockerfile",
        "Makefile",
        "go.mod",
        "docs/adr/1.md",
        "docs/adr/2.md",
      ],
    });
    assert.match(v.reasons.join(" "), /\+2 more/);
  });

  test("goes stale on age alone", () => {
    const v = assess({ claudeMd: managed(SHA, "2026-01-01"), commitsSince: 0, changedFiles: [] });
    assert.equal(v.status, "stale");
    assert.match(v.reasons[0], /days old/);
  });

  test("reports an unknown recorded commit without also reporting churn", () => {
    const v = assess({
      claudeMd: managed(SHA, "2026-07-30"),
      shaKnown: false,
      commitsSince: 0,
      changedFiles: [],
    });
    assert.equal(v.status, "stale");
    assert.match(v.reasons[0], /not in this repository/);
  });
});

describe("renderNotice", () => {
  test("is silent when fresh", () => {
    assert.equal(renderNotice({ status: "fresh", reasons: [], action: null }), null);
    assert.equal(renderNotice(null), null);
  });

  test("names the status, the reasons, and the action", () => {
    const notice = renderNotice(assess({ claudeMd: null }));
    assert.match(notice, /missing/);
    assert.match(notice, /project-context/);
    assert.match(notice, /Mention this to the user/);
  });
});
