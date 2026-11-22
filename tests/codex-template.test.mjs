/**
 * The copy-in Codex hook template (examples/codex) and the validator rule that
 * keeps it honest. Schema keys come from the documentation-derived reference
 * plugins/team-skills/references/agent-tool-contracts.md; best effort, not
 * verified by the maintainer.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCodexTemplate } from "../scripts/codex-template.mjs";
import { validate } from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(REPO_ROOT, p), "utf8");

describe("examples/codex/hooks.json", () => {
  const config = JSON.parse(read("examples/codex/hooks.json"));
  const entries = Object.entries(config.hooks ?? {}).flatMap(([event, groups]) =>
    groups.flatMap((g) => g.hooks.map((h) => ({ event, matcher: g.matcher, ...h }))),
  );

  test("uses the documented shape: hooks > event > [{matcher, hooks:[{type,command,timeout}]}]", () => {
    assert.ok(config.hooks && typeof config.hooks === "object");
    assert.ok(entries.length >= 3);
    for (const e of entries) {
      assert.equal(e.type, "command");
      assert.equal(typeof e.command, "string");
      assert.equal(typeof e.timeout, "number");
    }
  });

  test("covers shell, file edits and session start", () => {
    const by = (event) => entries.filter((e) => e.event === event);
    assert.match(by("PreToolUse").map((e) => e.matcher).join(" "), /Bash/);
    assert.match(by("PreToolUse").map((e) => e.matcher).join(" "), /apply_patch/);
    assert.ok(by("SessionStart").length >= 1);
  });

  test("every command goes through the launcher and names an existing wrapper", () => {
    for (const e of entries) {
      assert.match(e.command, /team-skills-hook\.sh/, e.command);
      const wrapper = /(codex-[a-z-]+\.mjs)/.exec(e.command)?.[1];
      assert.ok(wrapper, `no wrapper in ${e.command}`);
      assert.ok(existsSync(join(REPO_ROOT, "plugins/team-skills/hooks", wrapper)), `${wrapper} missing`);
    }
  });

  test("the launcher is shipped next to it", () => {
    assert.ok(existsSync(join(REPO_ROOT, "examples/codex/team-skills-hook.sh")));
  });
});

describe("Codex manifest keeps plugin-registered hooks empty", () => {
  test("extensions.com.openai.hooks stays {}", () => {
    const m = JSON.parse(read("plugins/team-skills/plugin.json"));
    assert.deepEqual(m.extensions.com.openai.hooks, {});
  });
});

describe("README and docs state the Codex hook facts", () => {
  const readme = read("README.md");
  const section = readme.split(/^## /m).find((s) => s.startsWith("Works with")) ?? "";
  const codex = section.split(/^### /m).find((s) => s.startsWith("Codex")) ?? "";

  test("Codex subsection documents the template, trust step, bypass flag and the real wall", () => {
    assert.match(codex, /examples\/codex/);
    assert.match(codex, /trust/i);
    assert.match(codex, /dangerously-bypass-hook-trust|bypass/i);
    assert.match(codex, /git hooks and CI|real (enforcement )?wall/i);
    assert.match(codex, /best effort/i);
  });

  test("Codex subsection says edits made through shell commands bypass the quality guard", () => {
    assert.match(codex, /heredoc|tee|sed -i/i);
    assert.match(codex, /bypass/i);
    assert.match(codex, /\.agents\/engineering-overrides\.md/);
  });

  test("the Codex table row says the hooks are a copy-in template, best effort", () => {
    const row = section.split("\n").find((l) => /^\|\s*Codex/.test(l)) ?? "";
    assert.match(row, /template/i);
    assert.match(row, /best effort/i);
  });
});

describe("validateCodexTemplate", () => {
  let root;
  const errors = () => {
    const out = [];
    validateCodexTemplate(root, (m) => out.push(m));
    return out;
  };
  const hook = (wrapper) => ({ type: "command", command: `sh .codex/team-skills-hook.sh ${wrapper}`, timeout: 30 });
  const scaffold = ({ hooks, launcher = true, wrapper = true, extraWrappers = ["codex-guard-quality.mjs", "codex-session-context.mjs"] } = {}) => {
    mkdirSync(join(root, "examples", "codex"), { recursive: true });
    mkdirSync(join(root, "plugins", "team-skills", "hooks"), { recursive: true });
    writeFileSync(
      join(root, "examples", "codex", "hooks.json"),
      JSON.stringify(
        hooks ?? {
          hooks: {
            PreToolUse: [
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: "sh .codex/team-skills-hook.sh codex-guard-git.mjs", timeout: 30 }],
              },
            ],
          },
        },
      ),
    );
    if (launcher) writeFileSync(join(root, "examples", "codex", "team-skills-hook.sh"), "#!/bin/sh\n");
    if (wrapper) writeFileSync(join(root, "plugins", "team-skills", "hooks", "codex-guard-git.mjs"), "");
    for (const w of extraWrappers) writeFileSync(join(root, "plugins", "team-skills", "hooks", w), "");
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "codex-template-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("the real repo is clean", () => {
    assert.deepEqual(validate(REPO_ROOT), []);
  });

  test("a repo without the template is not an error", () => {
    assert.deepEqual(errors(), []);
  });

  test("accepts a well-formed template", () => {
    scaffold();
    assert.deepEqual(errors(), []);
  });

  test("flags invalid JSON", () => {
    scaffold();
    writeFileSync(join(root, "examples", "codex", "hooks.json"), "{nope");
    assert.match(errors().join("\n"), /hooks\.json.*(parse|JSON)/i);
  });

  test("flags a missing launcher", () => {
    scaffold({ launcher: false });
    assert.match(errors().join("\n"), /team-skills-hook\.sh/);
  });

  test("flags a wrapper that does not exist", () => {
    scaffold({ wrapper: false });
    assert.match(errors().join("\n"), /codex-guard-git\.mjs/);
  });

  test("flags a command that bypasses the launcher", () => {
    scaffold({
      hooks: { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node x.mjs", timeout: 5 }] }] } },
    });
    assert.match(errors().join("\n"), /launcher/i);
  });

  test("flags a missing documented key (type, command or timeout)", () => {
    scaffold({
      hooks: {
        hooks: {
          PreToolUse: [{ matcher: "Bash", hooks: [{ command: "sh team-skills-hook.sh codex-guard-git.mjs" }] }],
        },
      },
    });
    const out = errors().join("\n");
    assert.match(out, /type/);
    assert.match(out, /timeout/);
  });

  test("flags a misspelled event name", () => {
    scaffold({ hooks: { hooks: { PreToolUsee: [{ matcher: "Bash", hooks: [hook("codex-guard-git.mjs")] }] } } });
    assert.match(errors().join("\n"), /PreToolUsee/);
  });

  test("flags a PreToolUse entry with no matcher", () => {
    scaffold({ hooks: { hooks: { PreToolUse: [{ hooks: [hook("codex-guard-git.mjs")] }] } } });
    assert.match(errors().join("\n"), /matcher/);
  });

  test("flags the git wrapper wired to an edit matcher", () => {
    scaffold({ hooks: { hooks: { PreToolUse: [{ matcher: "apply_patch|Edit|Write", hooks: [hook("codex-guard-git.mjs")] }] } } });
    assert.match(errors().join("\n"), /codex-guard-git\.mjs.*Bash/);
  });

  test("flags the quality wrapper wired to Bash", () => {
    scaffold({ hooks: { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [hook("codex-guard-quality.mjs")] }] } } });
    assert.match(errors().join("\n"), /codex-guard-quality\.mjs/);
  });

  test("flags the session wrapper under PreToolUse", () => {
    scaffold({ hooks: { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [hook("codex-session-context.mjs")] }] } } });
    assert.match(errors().join("\n"), /codex-session-context\.mjs.*SessionStart/);
  });

  test("accepts the wrappers under their proper events and matchers", () => {
    scaffold({
      hooks: {
        hooks: {
          SessionStart: [{ hooks: [hook("codex-session-context.mjs")] }],
          PreToolUse: [
            { matcher: "Bash", hooks: [hook("codex-guard-git.mjs")] },
            { matcher: "apply_patch|Edit|Write", hooks: [hook("codex-guard-quality.mjs")] },
          ],
        },
      },
    });
    assert.deepEqual(errors(), []);
  });

  test("flags a missing top-level hooks object", () => {
    scaffold({ hooks: { PreToolUse: [] } });
    assert.match(errors().join("\n"), /`hooks`/);
  });
});
