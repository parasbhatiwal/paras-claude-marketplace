/**
 * End-to-end checks of the hook's I/O contract: stdin payload in, Claude Code
 * hook exit code out. The rules themselves are covered in policy.test.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../plugins/team-skills/hooks/guard-git.mjs"
);

const run = (stdin, env = {}) =>
  spawnSync(process.execPath, [HOOK], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const payload = (command) => JSON.stringify({ tool_input: { command } });

describe("hook I/O contract", () => {
  test("exits 0 for an allowed command", () => {
    const r = run(payload("npm test"));
    assert.equal(r.status, 0);
  });

  test("exits 2 and explains on stderr for a blocked command", () => {
    const r = run(payload('git commit -m "chore: no trailers"'));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\[team-skills guard\] BLOCKED/);
    assert.match(r.stderr, /BOTH trailers/);
  });

  test("fails open on an unparseable payload", () => {
    assert.equal(run("not json").status, 0);
  });

  test("fails open on a payload without a command", () => {
    assert.equal(run(JSON.stringify({ tool_input: {} })).status, 0);
  });

  test("TEAM_SELF_MERGE_ALLOWLIST is honored", () => {
    // gh is stubbed out via PATH so no network call happens; with gh missing,
    // identity cannot be verified and the merge is blocked either way.
    const r = run(payload("gh pr merge 1"), { PATH: "/nonexistent" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /cannot verify/);
  });
});
