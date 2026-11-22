/**
 * The shared escalation ladder (quality-ladder.mjs), used by the Claude, Cursor
 * and Codex quality wrappers. Real escalation rules and a real git repository;
 * nothing mocked.
 */
import { test, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyLadder, ladderStatePath } from "../plugins/team-skills/hooks/quality-ladder.mjs";

let repo;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "ladder-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
  mkdirSync(join(repo, "src"));
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const session = () => `ladder-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const finding = (filePath, ruleId = "silenced-type", line = 1) => ({
  filePath,
  ruleId,
  line,
  text: "const a: x = 1;",
  why: "because",
});
const ledgerText = () => {
  const p = join(repo, ".claude", "engineering-overrides.md");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};
const ask = (tool, id, findings) => applyLadder({ tool, findings, sessionId: id, cwd: repo });

describe("state files never collide across tools", () => {
  test("claude keeps the legacy name, cursor and codex are prefixed", () => {
    assert.match(ladderStatePath("claude", "abc"), /team-skills[\\/]abc\.json$/);
    assert.match(ladderStatePath("cursor", "abc"), /team-skills[\\/]cursor-abc\.json$/);
    assert.match(ladderStatePath("codex", "abc"), /team-skills[\\/]codex-abc\.json$/);
  });

  test("the same session id in two tools argues separately", () => {
    const id = session();
    ask("cursor", id, [finding("src/a.ts")]);
    ask("cursor", id, [finding("src/a.ts")]);
    assert.equal(ask("codex", id, [finding("src/a.ts")]).exitCode, 2);
    assert.equal(ask("cursor", id, [finding("src/a.ts")]).exitCode, 0);
  });
});

describe("attempt keys are normalised", () => {
  test("relative, ./relative and absolute spellings are one file", () => {
    const id = session();
    assert.equal(ask("cursor", id, [finding("src/a.ts")]).exitCode, 2);
    assert.equal(ask("cursor", id, [finding("./src/a.ts")]).exitCode, 2);
    const third = ask("cursor", id, [finding(join(repo, "src", "a.ts"))]);
    assert.equal(third.exitCode, 0);
    assert.match(third.stderr, /Overriding/);
  });
});

describe("a concession is counted and recorded once", () => {
  test("a later edit of the conceded rule is silent and adds no ledger line", () => {
    const id = session();
    ask("cursor", id, [finding("src/a.ts")]);
    ask("cursor", id, [finding("src/a.ts")]);
    assert.equal(ask("cursor", id, [finding("src/a.ts")]).exitCode, 0);
    const before = ledgerText();
    assert.equal(before.match(/overridden after/g).length, 1);

    const again = ask("cursor", id, [finding("src/a.ts")]);
    assert.equal(again.exitCode, 0);
    assert.equal(again.stderr, "");
    assert.equal(ledgerText(), before);
  });

  test("a conceded rule is not re-counted when a new rule blocks the same call", () => {
    const id = session();
    for (let i = 0; i < 3; i++) ask("cursor", id, [finding("src/a.ts")]);
    const mixed = ask("cursor", id, [finding("src/a.ts"), finding("src/a.ts", "debug-leftover", 2)]);
    assert.equal(mixed.exitCode, 2);
    assert.doesNotMatch(mixed.stderr, /silenced-type/);
    assert.match(mixed.stderr, /debug-leftover/);
  });

  test("only blocked findings advance: a new rule gets its own full ladder", () => {
    const id = session();
    for (let i = 0; i < 3; i++) ask("cursor", id, [finding("src/a.ts")]);
    const dbg = () => ask("cursor", id, [finding("src/a.ts"), finding("src/a.ts", "debug-leftover", 2)]);
    assert.equal(dbg().exitCode, 2);
    assert.equal(dbg().exitCode, 2);
    assert.equal(dbg().exitCode, 0);
    assert.equal(ledgerText().match(/debug-leftover/g).length, 1);
    assert.equal(ledgerText().match(/silenced-type/g).length, 1);
  });
});

test("no findings is a silent allow", () => {
  assert.deepEqual(ask("cursor", session(), []), { exitCode: 0, stderr: "" });
});
