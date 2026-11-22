/**
 * Process-level tests for the Codex hook wrappers and the copy-in launcher.
 *
 * FIXTURES ARE DOCUMENTATION-DERIVED. Every payload is built by hand from the
 * Codex hooks fields listed in plugins/team-skills/references/agent-tool-contracts.md
 * (session_id, cwd, hook_event_name, tool_name, tool_input.command). None is a
 * recorded real payload: nobody on the project can run Codex. Best effort, not
 * verified by the maintainer.
 *
 * Each wrapper runs as a real child process; the policy and quality modules
 * underneath are real and nothing is mocked. Forbidden-flag fixtures are
 * assembled from parts so the repo's own git guard does not block this file.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(REPO_ROOT, "plugins/team-skills/hooks");
const LAUNCHER = join(REPO_ROOT, "examples/codex/team-skills-hook.sh");

const NO_VERIFY = ["--no", "verify"].join("-");
const TS_ANY = "const a: " + "any" + " = 1;";

let scratch;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "codex-hooks-"));
});
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

const base = (cwd, session = "sess-1") => ({
  session_id: session,
  transcript_path: "/t",
  cwd,
  hook_event_name: "PreToolUse",
  model: "m",
  turn_id: "t1",
  tool_use_id: "u1",
  permission_mode: "default",
});
const bash = (command, cwd = scratch, session) => ({ ...base(cwd, session), tool_name: "Bash", tool_input: { command } });
const patch = (body, cwd = scratch, session) => ({
  ...base(cwd, session),
  tool_name: "apply_patch",
  tool_input: { command: body },
});
const addFile = (path, line) => `*** Begin Patch\n*** Add File: ${path}\n+${line}\n*** End Patch\n`;

function runWrapper(name, input, { env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, TMPDIR: join(scratch, "tmp"), ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("codex-guard-git.mjs", () => {
  test("blocks a forbidden shell command: exit 2 with the policy reason", () => {
    const r = runWrapper("codex-guard-git.mjs", bash(`git push ${NO_VERIFY} origin feat/x`));
    assert.equal(r.status, 2);
    assert.match(r.stderr, /BLOCKED/);
    assert.match(r.stderr, new RegExp(NO_VERIFY));
  });

  test("allows an ordinary command silently", () => {
    const r = runWrapper("codex-guard-git.mjs", bash("ls -la"));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });

  test("unparseable payload exits 0 with the guard-inactive warning", () => {
    const r = runWrapper("codex-guard-git.mjs", "not json {");
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
  });

  test("a payload with no command exits 0 with the warning", () => {
    const r = runWrapper("codex-guard-git.mjs", { ...base(scratch), tool_name: "Bash", tool_input: {} });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
  });

  test("leaves apply_patch events to the quality wrapper", () => {
    const r = runWrapper("codex-guard-git.mjs", patch(addFile("a.ts", TS_ANY)));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });
});

describe("codex-guard-quality.mjs", () => {
  const dirty = () => patch(addFile("src/a.ts", TS_ANY), scratch, "q-1");

  test("an apply_patch edit that breaks a rule is blocked with exit 2 and the reason", () => {
    const r = runWrapper("codex-guard-quality.mjs", dirty());
    assert.equal(r.status, 2);
    assert.match(r.stderr, /BLOCKED/);
    assert.match(r.stderr, /src\/a\.ts/);
  });

  test("a clean edit is allowed silently", () => {
    const r = runWrapper("codex-guard-quality.mjs", patch(addFile("src/a.ts", "const a = 1;")));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });

  test("an edit with a written reason passes immediately", () => {
    const line = `${TS_ANY} // why: the vendor types this as unknown at the boundary`;
    const r = runWrapper("codex-guard-quality.mjs", patch(addFile("src/a.ts", line)));
    assert.equal(r.status, 0);
  });

  test("unparseable payload exits 0 with the guard-inactive warning", () => {
    const r = runWrapper("codex-guard-quality.mjs", "<<<");
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
  });

  test("an edit event missing the fields the guard needs warns and allows", () => {
    const r = runWrapper("codex-guard-quality.mjs", { ...base(scratch), tool_name: "apply_patch", tool_input: {} });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
  });

  test("shell commands are not this wrapper's business", () => {
    const r = runWrapper("codex-guard-quality.mjs", bash(`git push ${NO_VERIFY}`));
    assert.equal(r.status, 0);
    assert.equal(r.stderr, "");
  });

  describe("escalation ladder (mirrors guard-quality.mjs)", () => {
    let repo;
    beforeEach(() => {
      repo = join(scratch, "repo");
      mkdirSync(repo);
      execFileSync("git", ["init", "--quiet"], { cwd: repo });
    });
    const attempt = (session = "esc-1", file = "src/a.ts") =>
      runWrapper("codex-guard-quality.mjs", patch(addFile(file, TS_ANY), repo, session));

    test("explains, insists, then concedes on the third attempt and records it", () => {
      const first = attempt();
      assert.equal(first.status, 2);
      const second = attempt();
      assert.equal(second.status, 2);
      assert.match(second.stderr, /second time/i);
      const third = attempt();
      assert.equal(third.status, 0);
      assert.match(third.stderr, /overrid/i);

      const ledger = join(repo, ".agents", "engineering-overrides.md");
      assert.ok(existsSync(ledger), "override must be recorded");
      assert.match(readFileSync(ledger, "utf8"), /src\/a\.ts/);
      assert.ok(!existsSync(join(repo, ".claude")), "a Codex repo must not get a .claude folder");
    });

    test("without a session_id, different working directories do not share a counter", () => {
      const other = join(scratch, "other");
      mkdirSync(other);
      execFileSync("git", ["init", "--quiet"], { cwd: other });
      const noSession = (cwd) => {
        const p = patch(addFile("src/a.ts", TS_ANY), cwd);
        delete p.session_id;
        return runWrapper("codex-guard-quality.mjs", p);
      };
      assert.equal(noSession(repo).status, 2);
      assert.equal(noSession(repo).status, 2);
      assert.equal(noSession(other).status, 2, "a different cwd starts its own ladder");
      assert.equal(noSession(repo).status, 0, "the same cwd still reaches the third attempt");
    });

    test("a different file starts its own argument", () => {
      attempt("esc-2", "src/a.ts");
      attempt("esc-2", "src/a.ts");
      assert.equal(attempt("esc-2", "src/b.ts").status, 2);
    });

    test("a new session starts the ladder again", () => {
      attempt("esc-3");
      attempt("esc-3");
      assert.equal(attempt("esc-4").status, 2);
    });

    test("a file about to be conceded is not counted while a sibling still blocks", () => {
      attempt("esc-5", "src/a.ts");
      attempt("esc-5", "src/a.ts");
      const both = `*** Begin Patch\n*** Add File: src/a.ts\n+${TS_ANY}\n*** Add File: src/c.ts\n+${TS_ANY}\n*** End Patch\n`;
      const r = runWrapper("codex-guard-quality.mjs", patch(both, repo, "esc-5"));
      assert.equal(r.status, 2, "src/c.ts is on its first refusal, so the call blocks");
      assert.doesNotMatch(r.stderr, /in src\/a\.ts/);
      assert.equal(attempt("esc-5", "src/a.ts").status, 0, "src/a.ts still concedes on its third real attempt");
    });
  });
});

describe("codex-session-context.mjs", () => {
  test("is a safe no-op: exit 0, no stdout, a clear best-effort note on stderr", () => {
    const r = runWrapper("codex-session-context.mjs", { ...base(scratch), hook_event_name: "SessionStart" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /inactive/i);
    assert.match(r.stderr, /best effort/i);
  });

  test("does not depend on stdin at all", () => {
    const r = runWrapper("codex-session-context.mjs", "garbage");
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  });
});

describe("launcher team-skills-hook.sh", () => {
  let codexHome;
  /** Installs a fake plugin version whose wrappers echo what they received. */
  const install = (version, { marketplace = "mkt", wrapper = "codex-guard-git.mjs", body } = {}) => {
    const dir = join(codexHome, "plugins", "cache", marketplace, "team-skills", version, "hooks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, wrapper),
      body ??
        `import { readFileSync } from "node:fs";
process.stdout.write("version=${version} stdin=" + readFileSync(0, "utf8"));
process.exit(Number(process.env.FAKE_EXIT ?? 0));
`,
    );
  };
  const nodeDir = dirname(process.execPath);
  const run = (args, { input = "", env = {}, path } = {}) => {
    const r = spawnSync("/bin/sh", [LAUNCHER, ...args], {
      input,
      encoding: "utf8",
      env: {
        PATH: path ?? `${nodeDir}:/usr/bin:/bin`,
        HOME: join(scratch, "home"),
        CODEX_HOME: codexHome,
        ...env,
      },
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };

  beforeEach(() => {
    codexHome = join(scratch, "codex-home");
    mkdirSync(codexHome, { recursive: true });
  });

  test("picks the newest version by semantic order, not lexical order", () => {
    for (const v of ["2.2.0", "2.9.0", "2.10.0"]) install(v);
    const r = run(["codex-guard-git.mjs"], { input: "{}" });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^version=2\.10\.0 /);
  });

  test("finds the plugin under any marketplace name and picks the newest across them", () => {
    install("2.9.0", { marketplace: "alpha" });
    install("2.10.1", { marketplace: "zeta-market" });
    install("1.0.0", { marketplace: "beta" });
    assert.match(run(["codex-guard-git.mjs"]).stdout, /^version=2\.10\.1 /);
  });

  test("passes stdin through to the wrapper", () => {
    install("2.10.0");
    const r = run(["codex-guard-git.mjs"], { input: '{"tool_input":{"command":"ls"}}' });
    assert.match(r.stdout, /stdin=\{"tool_input":\{"command":"ls"\}\}$/);
  });

  test("propagates the wrapper's exit code, including a block", () => {
    install("2.10.0");
    assert.equal(run(["codex-guard-git.mjs"], { env: { FAKE_EXIT: "2" } }).status, 2);
    assert.equal(run(["codex-guard-git.mjs"], { env: { FAKE_EXIT: "0" } }).status, 0);
  });

  test("uses HOME/.codex when CODEX_HOME is unset", () => {
    const home = join(scratch, "home");
    codexHome = join(home, ".codex");
    install("2.10.0");
    const r = run(["codex-guard-git.mjs"], { env: { CODEX_HOME: "" } });
    assert.match(r.stdout, /version=2\.10\.0/);
  });

  test("ignores non-semver directories: local, pre-releases, extra segments", () => {
    install("2.9.0");
    for (const v of ["local", "2.10.0-rc1", "2.11", "3.0.0.1", "v3.0.0"]) install(v);
    assert.match(run(["codex-guard-git.mjs"]).stdout, /^version=2\.9\.0 /);
  });

  test("if the newest valid version lacks the wrapper, fails open naming that version (never runs an older one)", () => {
    install("2.9.0");
    install("2.10.0", { wrapper: "other.mjs" });
    const r = run(["codex-guard-git.mjs"]);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /guard inactive/i);
    assert.match(r.stderr, /2\.10\.0 lacks codex-guard-git\.mjs/);
    assert.match(r.stderr, /update the plugin/i);
  });

  test("fails open with a guard-inactive warning when no plugin is installed", () => {
    const r = run(["codex-guard-git.mjs"], { input: "{}" });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
    assert.match(r.stderr, /team-skills/);
  });

  test("fails open with a warning when node is absent (PATH has no node)", () => {
    install("2.10.0");
    const empty = join(scratch, "empty-bin");
    mkdirSync(empty);
    const r = run(["codex-guard-git.mjs"], { path: empty });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
    assert.match(r.stderr, /node/i);
  });

  test("fails open when no wrapper name is given", () => {
    install("2.10.0");
    const r = run([]);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
  });

  test("refuses a wrapper name that tries to leave the hooks directory", () => {
    install("2.10.0");
    const r = run(["../../evil.mjs"]);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /guard inactive/i);
    assert.equal(r.stdout, "");
  });

  test("makes no network access: the script never mentions a network tool", () => {
    const text = readFileSync(LAUNCHER, "utf8");
    assert.doesNotMatch(text, /\b(curl|wget|nc|ssh|git (clone|fetch|pull))\b/);
  });

  test("the hooks.json command fails open (not 127) when the launcher is missing", () => {
    const config = JSON.parse(readFileSync(join(REPO_ROOT, "examples/codex/hooks.json"), "utf8"));
    const commands = Object.values(config.hooks).flatMap((gs) => gs.flatMap((g) => g.hooks.map((h) => h.command)));
    assert.ok(commands.length >= 3);
    const bare = join(scratch, "no-launcher");
    mkdirSync(bare);
    for (const command of commands) {
      const r = spawnSync("/bin/sh", ["-c", command], { cwd: bare, input: "{}", encoding: "utf8" });
      assert.equal(r.status, 0, command);
      assert.match(r.stderr, /guard inactive/i);
    }
  });

  test("the hooks.json command passes the launcher's exit 2 through when it is present", () => {
    install("2.10.0", { wrapper: "codex-guard-git.mjs" });
    const project = join(scratch, "project");
    mkdirSync(join(project, ".codex"), { recursive: true });
    writeFileSync(join(project, ".codex", "team-skills-hook.sh"), readFileSync(LAUNCHER));
    const config = JSON.parse(readFileSync(join(REPO_ROOT, "examples/codex/hooks.json"), "utf8"));
    const command = config.hooks.PreToolUse[0].hooks[0].command;
    const r = spawnSync("/bin/sh", ["-c", command], {
      cwd: project,
      input: "{}",
      encoding: "utf8",
      env: { PATH: `${nodeDir}:/usr/bin:/bin`, HOME: join(scratch, "home"), CODEX_HOME: codexHome, FAKE_EXIT: "2" },
    });
    assert.equal(r.status, 2);
  });

  test("runs the real wrapper end to end: a blocked command exits 2 through the launcher", () => {
    const dir = join(codexHome, "plugins", "cache", "mkt", "team-skills", "2.10.0");
    mkdirSync(dir, { recursive: true });
    // Point the fake install's hooks at the real wrapper sources.
    execFileSync("cp", ["-R", HOOKS, join(dir, "hooks")]);
    const r = run(["codex-guard-git.mjs"], { input: JSON.stringify(bash(`git push ${NO_VERIFY} origin feat/x`)) });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /BLOCKED/);
  });
});
