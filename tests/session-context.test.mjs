/**
 * End-to-end checks of the SessionStart hook against real git repositories:
 * stdin payload in, SessionStart JSON (or silence) out.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../plugins/team-skills/hooks/session-context.mjs"
);

let repo;
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

const commit = (message, files = {}) => {
  for (const [path, contents] of Object.entries(files)) {
    writeFileSync(join(repo, path), contents);
  }
  git("add", "-A");
  git("-c", "core.hooksPath=/dev/null", "commit", "--quiet", "--allow-empty", "-m", message);
  return git("rev-parse", "HEAD");
};

const run = (cwd = repo) => {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd }),
    encoding: "utf8",
  });
  return {
    status: r.status,
    context: r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : null,
  };
};

const managed = (sha) =>
  `# Project\n\n<!-- claude-context: sha=${sha} generated=${new Date()
    .toISOString()
    .slice(0, 10)} -->\n\n## What this is\nA test fixture.\n`;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "session-ctx-"));
  git("init", "--quiet");
  git("config", "user.name", "Paras");
  git("config", "user.email", "paras@example.com");
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("SessionStart context hook", () => {
  test("stays silent when the context is fresh", () => {
    const sha = commit("chore: init", { "README.md": "# hi\n" });
    commit("docs: claude context", { "CLAUDE.md": managed(sha) });
    const r = run();
    assert.equal(r.status, 0);
    assert.equal(r.context, null);
  });

  test("nudges when CLAUDE.md is absent", () => {
    commit("chore: init", { "README.md": "# hi\n" });
    const r = run();
    assert.equal(r.status, 0);
    assert.match(r.context, /missing/);
    assert.match(r.context, /project-context/);
  });

  test("nudges when CLAUDE.md carries no fingerprint", () => {
    commit("chore: init", { "CLAUDE.md": "# Project\n\nhand written\n" });
    assert.match(run().context, /unmanaged/);
  });

  test("nudges after a structural change", () => {
    const sha = commit("chore: init", { "README.md": "# hi\n" });
    commit("docs: claude context", { "CLAUDE.md": managed(sha) });
    commit("chore: add deps", { "package.json": '{"name":"x"}\n' });
    assert.match(run().context, /stale/);
    assert.match(run().context, /package\.json/);
  });

  test("nudges when the recorded commit is not in the repository", () => {
    commit("chore: init", { "README.md": "# hi\n" });
    commit("docs: claude context", {
      "CLAUDE.md": managed("0123456789abcdef0123456789abcdef01234567"),
    });
    assert.match(run().context, /not in this repository/);
  });

  test("stays silent outside a git repository", () => {
    const plain = mkdtempSync(join(tmpdir(), "not-a-repo-"));
    try {
      const r = run(plain);
      assert.equal(r.status, 0);
      assert.equal(r.context, null);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  test("never fails the session", () => {
    const r = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
  });
});
