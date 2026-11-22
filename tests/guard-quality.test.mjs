/**
 * Process-level characterization of the Claude Code quality hook
 * (guard-quality.mjs): payload on stdin, exit code, stderr and the override
 * ledger out. Written before the ladder was shared with the Cursor and Codex
 * wrappers, so it pins that Claude's behaviour did not change.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), "../plugins/team-skills/hooks/guard-quality.mjs");
const DIRTY = `const actor: ${"a" + "ny"} = resolve();`;

let repo;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "claude-quality-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const session = () => `cq-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const run = (id, input) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: id, cwd: repo, tool_name: "Write", tool_input: input }),
    encoding: "utf8",
  });
const ledger = () => join(repo, ".claude", "engineering-overrides.md");

test("blocks, insists, concedes on the third ask and records it", () => {
  const id = session();
  const input = { file_path: "src/a.ts", content: DIRTY };
  const first = run(id, input);
  assert.equal(first.status, 2);
  assert.match(first.stderr, /^\[team-skills guard\] BLOCKED\n/);
  assert.match(first.stderr, /deliberate, exception|deliberate exception/);
  const second = run(id, input);
  assert.equal(second.status, 2);
  assert.match(second.stderr, /second time/);
  assert.equal(existsSync(ledger()), false);
  const third = run(id, input);
  assert.equal(third.status, 0);
  assert.match(third.stderr, /^\[team-skills guard\] Overriding/);
  const text = readFileSync(ledger(), "utf8");
  assert.ok(
    text.startsWith(
      "# Engineering overrides\n\n" +
        "Every time the team's quality guard was overruled, and on what. This file\n" +
        "is written by the guard, not by hand. A long list here is not a scandal —\n" +
        "it is a reading list for the next `principles-audit`, and a hint that a\n" +
        "rule may be wrong rather than the code.\n\n",
    ),
  );
  assert.match(text, /`src\/a\.ts:1`/);
});

test("allows clean content silently and writes no ledger", () => {
  const r = run(session(), { file_path: "src/a.ts", content: "const a = 1;\n" });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.equal(existsSync(ledger()), false);
});

test("state is per session and keeps the legacy file name", () => {
  const id = session();
  run(id, { file_path: "src/a.ts", content: DIRTY });
  assert.ok(existsSync(join(tmpdir(), "team-skills", `${id}.json`)));
  assert.equal(run(session(), { file_path: "src/a.ts", content: DIRTY }).status, 2);
});

test("unparseable payload exits 0", () => {
  const r = spawnSync(process.execPath, [HOOK], { input: "nope", encoding: "utf8" });
  assert.equal(r.status, 0);
});
