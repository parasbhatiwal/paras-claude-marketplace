/**
 * The shipped gitleaks config is a security control, so it is tested like one:
 * real gitleaks, real fixtures, asserting that the places secrets actually
 * hide are scanned rather than allowlisted away.
 *
 * Skipped when gitleaks is not installed — the pre-commit hook's grep fallback
 * is covered separately in task-hooks.test.mjs.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../examples/gitleaks.toml"
);

const hasGitleaks = spawnSync("gitleaks", ["version"], { encoding: "utf8" }).status === 0;

// Fake, but shaped like the real thing so the default ruleset matches. The
// assignment form matters: gitleaks' generic rules key off `name = value`
// proximity, so a bare mention in prose is not a finding in any file type.
const AWS_KEY = `AKIA${"1234567890ABCDEF"}`;
const secretLine = (value = AWS_KEY) => `apiKey = "${value}"\n`;

let repo;
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

/** Stages files and returns the number of leaks gitleaks reports. */
const leakCount = (files) => {
  for (const [path, contents] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  git("add", "-A");
  const r = spawnSync(
    "gitleaks",
    ["protect", "--staged", "--no-banner", "--config", join(repo, ".gitleaks.toml")],
    { cwd: repo, encoding: "utf8" }
  );
  // gitleaks exits 1 when it finds anything; the count is on stderr.
  const m = r.stderr.match(/leaks found:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gitleaks-cfg-"));
  git("init", "--quiet");
  git("config", "user.name", "Paras");
  git("config", "user.email", "paras@example.com");
  copyFileSync(CONFIG, join(repo, ".gitleaks.toml"));
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("shipped gitleaks config", { skip: hasGitleaks ? false : "gitleaks not installed" }, () => {
  test("catches a secret in ordinary source", () => {
    assert.equal(leakCount({ "src.py": secretLine() }), 1);
  });

  test("catches a secret in markdown", () => {
    // Regression: an allowlist of `\.md$` meant ADRs, runbooks and CLAUDE.md —
    // where connection strings get pasted while documenting — were never
    // scanned at all.
    assert.equal(leakCount({ "docs/adr/0001-db.md": secretLine() }), 1);
  });

  test("catches a secret in a test file", () => {
    // Regression: `\.test\.` and `\.spec\.` were allowlisted, which is the
    // single most common home for a real credential.
    assert.equal(leakCount({ "app.test.js": secretLine() }), 1);
  });

  test("catches a secret in fixtures", () => {
    assert.equal(leakCount({ "fixtures/creds.json": secretLine() }), 1);
  });

  test("does not flag the required Claude co-author trailer", () => {
    assert.equal(leakCount({ "notes.md": "Co-Authored-By: Claude <noreply@anthropic.com>\n" }), 0);
  });

  test("does not flag documentation placeholders", () => {
    assert.equal(leakCount({ "README.md": "Set EXAMPLE_API_KEY in your env.\n" }), 0);
  });

  test("does not flag this repo's own detection patterns", () => {
    // The hooks contain regexes describing secret shapes; those must not read
    // as secrets themselves, or every project would fail its own scan.
    const patterns = "AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}\n";
    assert.equal(leakCount({ "hook.sh": patterns }), 0);
  });
});
