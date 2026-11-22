/**
 * Process-level tests of the Cursor hook wrappers: stdin payload in, exit code,
 * stderr and stdout out. The real policy and quality modules run; nothing is
 * mocked.
 *
 * FIXTURES ARE DOCUMENTATION-DERIVED. They follow the field names in
 * plugins/team-skills/references/agent-tool-contracts.md (Cursor hooks docs),
 * not recorded real Cursor payloads. Best effort, not verified by the
 * maintainer.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), "../plugins/team-skills/hooks");
const GIT_HOOK = join(HOOKS, "cursor-guard-git.mjs");
const QUALITY_HOOK = join(HOOKS, "cursor-guard-quality.mjs");
const SESSION_HOOK = join(HOOKS, "cursor-session-context.mjs");

const run = (hook, stdin, env = {}) =>
  spawnSync(process.execPath, [hook], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

let repo;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "cursor-hooks-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

const INACTIVE = /\[team-skills guard\] WARNING: guard inactive/;

describe("cursor-guard-git.mjs (beforeShellExecution)", () => {
  const shell = (command) =>
    JSON.stringify({
      hook_event_name: "beforeShellExecution",
      conversation_id: `git-${Date.now()}`,
      command,
      cwd: repo,
    });

  test("blocks a violation: exit 2 with the policy reason on stderr", () => {
    const r = run(GIT_HOOK, shell('git commit -m "chore: no trailers"'));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\[team-skills guard\] BLOCKED/);
    assert.match(r.stderr, /BOTH trailers/);
  });

  test("allows a harmless command silently", () => {
    const r = run(GIT_HOOK, shell("npm test"));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    assert.equal(r.stdout, "");
  });

  test("an unparseable payload exits 0 with the inactive-guard warning", () => {
    const r = run(GIT_HOOK, "not json");
    assert.equal(r.status, 0);
    assert.match(r.stderr, INACTIVE);
  });

  test("a git guard runs on preToolUse for Shell too, wired in the hooks config", () => {
    const config = JSON.parse(readFileSync(join(HOOKS, "cursor-hooks.json"), "utf8"));
    const shellPre = config.hooks.preToolUse.find(
      (h) => /cursor-guard-git\.mjs/.test(h.command) && h.matcher === "Shell",
    );
    assert.ok(shellPre, "cursor-guard-git.mjs must be wired on preToolUse with matcher Shell");
    assert.ok(config.hooks.beforeShellExecution.some((h) => /cursor-guard-git\.mjs/.test(h.command)));
  });

  test("the same rule applies through preToolUse on Shell", () => {
    const r = run(
      GIT_HOOK,
      JSON.stringify({
        hook_event_name: "preToolUse",
        conversation_id: "git-pretool",
        tool_name: "Shell",
        tool_input: { command: 'git commit -m "chore: no trailers"' },
        cwd: repo,
      }),
    );
    assert.equal(r.status, 2);
    assert.match(r.stderr, /BOTH trailers/);
  });
});

describe("cursor-guard-quality.mjs (preToolUse on file writes)", () => {
  // Assembled so this test file itself never contains the flagged construct.
  const DIRTY = `const actor: ${"a" + "ny"} = resolve();`;
  const write = (conversationId, content, filePath = "src/actor.ts") =>
    JSON.stringify({
      hook_event_name: "preToolUse",
      conversation_id: conversationId,
      tool_name: "Write",
      tool_input: { file_path: filePath, content },
      cwd: repo,
    });
  const ledger = () => join(repo, ".claude", "engineering-overrides.md");
  const session = () => `quality-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  test("blocks a violation: exit 2 with the rule on stderr", () => {
    const r = run(QUALITY_HOOK, write(session(), DIRTY));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /\[team-skills guard\] BLOCKED/);
    assert.match(r.stderr, /silenced-type/);
  });

  test("allows clean content silently", () => {
    const r = run(QUALITY_HOOK, write(session(), "const actor = resolve();\n"));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });

  test("ignores tools it does not cover", () => {
    const r = run(
      QUALITY_HOOK,
      JSON.stringify({ hook_event_name: "preToolUse", tool_name: "Read", tool_input: { file_path: "a.ts" }, cwd: repo }),
    );
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });

  test("an unparseable payload exits 0 with the inactive-guard warning", () => {
    const r = run(QUALITY_HOOK, "not json");
    assert.equal(r.status, 0);
    assert.match(r.stderr, INACTIVE);
  });

  test("a write payload without the needed fields warns and allows", () => {
    const r = run(
      QUALITY_HOOK,
      JSON.stringify({ hook_event_name: "preToolUse", tool_name: "Write", tool_input: {}, cwd: repo }),
    );
    assert.equal(r.status, 0);
    assert.match(r.stderr, INACTIVE);
  });

  test("escalation: blocks, insists, then concedes on the record at the third ask", () => {
    const id = session();
    const first = run(QUALITY_HOOK, write(id, DIRTY));
    assert.equal(first.status, 2);
    assert.match(first.stderr, /deliberate exception/);

    const second = run(QUALITY_HOOK, write(id, DIRTY));
    assert.equal(second.status, 2);
    assert.match(second.stderr, /second time/);
    assert.equal(existsSync(ledger()), false);

    const third = run(QUALITY_HOOK, write(id, DIRTY));
    assert.equal(third.status, 0);
    assert.match(third.stderr, /Overriding/);
    const record = readFileSync(ledger(), "utf8");
    assert.match(record, /src\/actor\.ts:1/);
    assert.match(record, /silenced-type/);

    // Once conceded it stays conceded for this file and rule.
    assert.equal(run(QUALITY_HOOK, write(id, DIRTY)).status, 0);
  });

  test("a justified exception goes through at once (no ladder needed)", () => {
    const r = run(QUALITY_HOOK, write(session(), `// why: the vendor type is wrong upstream\n${DIRTY}\n`));
    assert.equal(r.status, 0);
  });

  test("escalation is per session: a new session starts at the first refusal", () => {
    const a = session();
    run(QUALITY_HOOK, write(a, DIRTY));
    run(QUALITY_HOOK, write(a, DIRTY));
    assert.equal(run(QUALITY_HOOK, write(session(), DIRTY)).status, 2);
  });
});

describe("cursor-session-context.mjs (sessionStart)", () => {
  const start = (cwd) => JSON.stringify({ hook_event_name: "sessionStart", conversation_id: "s1", cwd });

  test("in a git repository returns additional_context carrying the workflow nudge", () => {
    const r = run(SESSION_HOOK, start(repo));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
    const out = JSON.parse(r.stdout);
    assert.match(out.additional_context, /Team workflow/);
  });

  test("reads the workspace from workspace_roots when cwd is absent", () => {
    const r = run(
      SESSION_HOOK,
      JSON.stringify({ hook_event_name: "sessionStart", workspace_roots: [repo] }),
    );
    assert.match(JSON.parse(r.stdout).additional_context, /Team workflow/);
  });

  test("accepts a file:// URI workspace root", () => {
    const r = run(
      SESSION_HOOK,
      JSON.stringify({ hook_event_name: "sessionStart", workspace_roots: [pathToFileURL(repo).href] }),
    );
    assert.match(JSON.parse(r.stdout).additional_context, /Team workflow/);
  });

  test("tries the next workspace root when the first is not a git repository", () => {
    const plain = mkdtempSync(join(tmpdir(), "cursor-plain-"));
    try {
      const r = run(
        SESSION_HOOK,
        JSON.stringify({ hook_event_name: "sessionStart", workspace_roots: [plain, repo] }),
        { GIT_CEILING_DIRECTORIES: tmpdir() },
      );
      assert.match(JSON.parse(r.stdout).additional_context, /Team workflow/);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  test("outside a git repository it is silent", () => {
    const plain = mkdtempSync(join(tmpdir(), "cursor-plain-"));
    try {
      const r = run(SESSION_HOOK, start(plain), { GIT_CEILING_DIRECTORIES: tmpdir() });
      assert.equal(r.status, 0);
      assert.equal(r.stdout, "");
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  test("an unparseable payload exits 0 and never blocks the session", () => {
    const r = run(SESSION_HOOK, "not json");
    assert.equal(r.status, 0);
  });
});
