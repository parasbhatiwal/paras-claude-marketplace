/**
 * The committed git hooks are the wall that stands even when Claude is not in
 * the loop, so they get the same test treatment as the session guard. Each
 * case runs the real hook script against a real throwaway git repo.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), "../examples/githooks");

const TRAILERS = [
  "Co-Authored-By: Paras <paras@example.com>",
  "Co-Authored-By: Claude <noreply@anthropic.com>",
].join("\n");

let repo;

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });

/** Writes files (path → contents) into the repo and stages them. */
const stage = (files) => {
  for (const [path, contents] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  git("add", "-A");
};

/** Runs the commit-msg hook against a message; returns {status, stderr}. */
const commitMsg = (message) => {
  const msgFile = join(repo, ".git", "COMMIT_EDITMSG_TEST");
  writeFileSync(msgFile, message);
  return spawnSync("sh", [join(HOOKS, "commit-msg"), msgFile], {
    cwd: repo,
    encoding: "utf8",
  });
};

const withTrailers = (subject, extra = "") =>
  `${subject}\n\n${extra ? `${extra}\n\n` : ""}${TRAILERS}\n`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "githook-test-"));
  git("init", "--quiet");
  git("config", "user.name", "Paras");
  git("config", "user.email", "paras@example.com");
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("commit-msg: co-author trailers", () => {
  test("accepts a message with both trailers", () => {
    stage({ "docs/readme.md": "# hi\n" });
    assert.equal(commitMsg(withTrailers("docs: add readme")).status, 0);
  });

  test("rejects a message with no trailers", () => {
    stage({ "docs/readme.md": "# hi\n" });
    const r = commitMsg("docs: add readme\n");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing 'Co-Authored-By: Claude/);
  });

  test("rejects a message missing the human trailer", () => {
    stage({ "docs/readme.md": "# hi\n" });
    const r = commitMsg(
      "docs: add readme\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n"
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing human/);
  });

  test("counts a human literally named Claude as the human trailer", () => {
    stage({ "docs/readme.md": "# hi\n" });
    const r = commitMsg(
      "docs: add readme\n\nCo-Authored-By: Claude Dupont <claude@example.com>\n" +
        "Co-Authored-By: Claude <noreply@anthropic.com>\n"
    );
    assert.equal(r.status, 0);
  });

  test("exempts merge and autosquash commits", () => {
    stage({ "src/thing.ts": "export const a = 1;\n" });
    assert.equal(commitMsg("Merge branch 'main' into feat/x\n").status, 0);
    assert.equal(commitMsg("fixup! feat: earlier commit\n").status, 0);
  });
});

describe("commit-msg: TDD test-presence gate", () => {
  test("blocks logic source committed without a test", () => {
    stage({ "src/cart.ts": "export const total = () => 0;\n" });
    const r = commitMsg(withTrailers("feat(cart): add total"));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /source changed without any test change/);
    assert.match(r.stderr, /src\/cart\.ts/);
  });

  test("allows logic source committed with a test", () => {
    stage({
      "src/cart.ts": "export const total = () => 0;\n",
      "src/cart.test.ts": "test('total', () => {});\n",
    });
    assert.equal(commitMsg(withTrailers("feat(cart): add total")).status, 0);
  });

  test("does not exempt plain .mjs source", () => {
    // Regression: a blanket *.mjs exemption let ESM-first projects skip TDD.
    stage({ "src/cart.mjs": "export const total = () => 0;\n" });
    assert.equal(commitMsg(withTrailers("feat(cart): add total")).status, 1);
  });

  test("gates every supported language, not just JS/TS", () => {
    const cases = {
      "src/cart.py": "def total(): return 0\n",
      "internal/cart.go": "package cart\n",
      "src/cart.rs": "pub fn total() -> u32 { 0 }\n",
      "app/models/cart.rb": "class Cart; end\n",
      "src/Cart.java": "class Cart {}\n",
      "src/Cart.kt": "class Cart\n",
      "Services/Cart.cs": "class Cart {}\n",
      "lib/cart.ex": "defmodule Cart do\nend\n",
      "src/cart.php": "<?php class Cart {}\n",
      "Sources/Cart.swift": "struct Cart {}\n",
      "lib/cart.dart": "class Cart {}\n",
      "src/cart.c": "int total(void) { return 0; }\n",
      "scripts/deploy.sh": "#!/bin/sh\necho deploy\n",
    };
    for (const [path, contents] of Object.entries(cases)) {
      rmSync(repo, { recursive: true, force: true });
      repo = mkdtempSync(join(tmpdir(), "githook-test-"));
      git("init", "--quiet");
      git("config", "user.name", "Paras");
      git("config", "user.email", "paras@example.com");
      stage({ [path]: contents });
      assert.equal(
        commitMsg(withTrailers("feat: add thing")).status,
        1,
        `${path} should require a test`
      );
    }
  });

  test("recognizes each language's test-file convention", () => {
    const pairs = [
      ["src/cart.py", "tests/test_cart.py"],
      ["internal/cart.go", "internal/cart_test.go"],
      ["src/cart.rb", "spec/cart_spec.rb"],
      ["src/Cart.java", "src/CartTest.java"],
      ["Services/Cart.cs", "Tests/CartTests.cs"],
      ["lib/cart.ex", "test/cart_test.exs"],
    ];
    for (const [source, testFile] of pairs) {
      rmSync(repo, { recursive: true, force: true });
      repo = mkdtempSync(join(tmpdir(), "githook-test-"));
      git("init", "--quiet");
      git("config", "user.name", "Paras");
      git("config", "user.email", "paras@example.com");
      stage({ [source]: "x\n", [testFile]: "y\n" });
      assert.equal(
        commitMsg(withTrailers("feat: add thing")).status,
        0,
        `${testFile} should count as a test for ${source}`
      );
    }
  });

  test("exempts generated protobuf and migration files in any language", () => {
    stage({
      "api/service_pb2.py": "# generated\n",
      "api/service.pb.go": "// generated\n",
      "db/migrations/003_add_index.rb": "class AddIndex; end\n",
    });
    assert.equal(commitMsg(withTrailers("chore: regenerate protos")).status, 0);
  });

  test("still exempts config entrypoints", () => {
    stage({ "vitest.config.mjs": "export default {};\n" });
    assert.equal(commitMsg(withTrailers("chore: tweak vitest config")).status, 0);
  });

  test("exempts docs, styles, and lockfiles", () => {
    stage({
      "README.md": "# hi\n",
      "src/app.css": "body{}\n",
      "package-lock.json": "{}\n",
    });
    assert.equal(commitMsg(withTrailers("docs: update readme")).status, 0);
  });

  test("waives the gate for a Justified-Exception trailer", () => {
    stage({ "src/cart.ts": "export const total = () => 1;\n" });
    const r = commitMsg(
      withTrailers("fix(cart): hotfix total", "Justified-Exception: production hotfix, PR #12")
    );
    assert.equal(r.status, 0);
    assert.match(r.stderr, /waived by Justified-Exception/);
  });

  test("does not accept an empty Justified-Exception reason", () => {
    stage({ "src/cart.ts": "export const total = () => 1;\n" });
    const r = commitMsg(withTrailers("fix(cart): hotfix total", "Justified-Exception:"));
    assert.equal(r.status, 1);
  });
});
