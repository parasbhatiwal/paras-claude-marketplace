/**
 * The pre-commit and pre-push hooks must work on any language, so they resolve
 * checks through the standard task interface rather than assuming npm. These
 * tests drive the real hooks against throwaway repos wired up different ways.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), "../examples/githooks");

let repo;
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

const write = (files) => {
  for (const [path, contents] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
};

const runHook = (name) =>
  spawnSync("sh", [join(HOOKS, name)], { cwd: repo, encoding: "utf8" });

/** A Makefile whose targets exit with the given codes. */
const makefile = (targets) =>
  Object.entries(targets)
    .map(([name, code]) => `${name}:\n\t@exit ${code}\n`)
    .join("\n");

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "task-hook-"));
  git("init", "--quiet");
  git("config", "user.name", "Paras");
  git("config", "user.email", "paras@example.com");
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("pre-push: test task resolution", () => {
  test("passes when the Makefile test target passes", () => {
    write({ Makefile: makefile({ test: 0 }), "main.go": "package main\n" });
    const r = runHook("pre-push");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /make test/);
  });

  test("blocks when the Makefile test target fails", () => {
    write({ Makefile: makefile({ test: 1 }) });
    const r = runHook("pre-push");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /test suite is RED/);
  });

  test("falls back to a package.json script when there is no Makefile", () => {
    write({ "package.json": JSON.stringify({ name: "x", scripts: { test: "exit 0" } }) });
    const r = runHook("pre-push");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /test/);
  });

  test("blocks a project with no test task at all", () => {
    write({ "README.md": "# just docs\n" });
    const r = runHook("pre-push");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no test task found/);
  });

  test("prefers the Makefile over ecosystem detection", () => {
    write({
      Makefile: makefile({ test: 0 }),
      "package.json": JSON.stringify({ name: "x", scripts: { test: "exit 1" } }),
    });
    assert.equal(runHook("pre-push").status, 0);
  });
});

describe("pre-commit: static checks", () => {
  test("passes and reports when no checks are configured", () => {
    write({ "README.md": "# docs\n" });
    const r = runHook("pre-commit");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /not configured/);
  });

  test("blocks when a configured lint task fails", () => {
    write({ Makefile: makefile({ lint: 1 }) });
    const r = runHook("pre-commit");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /lint failed/);
  });

  test("blocks when a configured typecheck task fails", () => {
    write({ Makefile: makefile({ typecheck: 1 }) });
    assert.equal(runHook("pre-commit").status, 1);
  });

  test("passes when every configured check passes", () => {
    write({ Makefile: makefile({ "format-check": 0, lint: 0, typecheck: 0 }) });
    const r = runHook("pre-commit");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /pre-commit gates passed/);
  });

  test("catches a staged private key without gitleaks installed", () => {
    write({ "config/key.pem": "-----BEGIN RSA PRIVATE KEY-----\nabc\n" });
    git("add", "-A");
    const r = spawnSync("sh", [join(HOOKS, "pre-commit")], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: "/usr/bin:/bin" }, // no gitleaks on this PATH
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /possible secret/);
  });
});
