import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESC = "Use this skill when you need a long enough trigger description to pass validation.";

let root;
const w = (rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const skill = (name, body = "Do the thing.", desc = DESC) =>
  `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n\n${body}\n`;
const P = "plugins/demo";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "neutral-"));
  w(
    ".claude-plugin/marketplace.json",
    JSON.stringify({ name: "m", owner: { name: "O" }, plugins: [{ name: "demo", source: "./plugins/demo" }] })
  );
  w(`${P}/.claude-plugin/plugin.json`, JSON.stringify({ name: "demo", version: "1.0.0", description: "d" }));
  w(`${P}/skills/alpha/SKILL.md`, skill("alpha"));
  w(`${P}/skills/browser-verify/SKILL.md`, skill("browser-verify", "> **Claude Code only.** Drives Claude in Chrome."));
  w(`${P}/skills/deliver/SKILL.md`, skill("deliver", "> **Cloud delivery is Claude Code only.** Run attended elsewhere."));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const errorsMatching = (re) => validate(root).filter((e) => re.test(e));

describe("Claude-only phrases outside a Claude Code note", () => {
  for (const [label, phrase] of [
    ["the code-review command", "Run `/code-review` on the diff."],
    ["the security-review command", "Then run `/security-review`."],
    ["Claude in Chrome", "Open it in Claude in Chrome."],
    ["the Claude trailer", "Add Co-Authored-By: Claude <x@y.z> to the message."],
    ["the Claude address", "The address is noreply@anthropic.com."],
  ]) {
    test(`fail on ${label} in a skill body`, () => {
      w(`${P}/skills/alpha/SKILL.md`, skill("alpha", phrase));
      const errs = errorsMatching(/alpha\/SKILL\.md:\d+.*Claude Code:/);
      assert.equal(errs.length, 1, errs.join("\n"));
    });
  }

  test("fail when the phrase is in the frontmatter description", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Fine.", `${DESC} Wraps the built-in /code-review.`));
    assert.equal(errorsMatching(/alpha\/SKILL\.md:3/).length, 1);
  });

  test("fail in a reference document and in a command", () => {
    w(`${P}/references/notes.md`, "Route to `/security-review`.\n");
    w(`${P}/commands/go.md`, "---\ndescription: d\n---\nUse `/code-review`.\n");
    assert.equal(errorsMatching(/references\/notes\.md:1/).length, 1);
    assert.equal(errorsMatching(/commands\/go\.md:4/).length, 1);
  });

  test("pass inside a (Claude Code: ...) note", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Run your tool's review (Claude Code: `/code-review`)."));
    assert.deepEqual(validate(root), []);
  });

  test("pass when the note wraps across lines", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Review it (Claude Code: the built-in\n`/code-review` skill, then\n`/security-review`)."));
    assert.deepEqual(validate(root), []);
  });

  test("a phrase after a closed note is still caught", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "(Claude Code: `/code-review`) and also `/security-review`."));
    assert.equal(errorsMatching(/alpha\/SKILL\.md/).length, 1);
  });
});

describe("files that are Claude-only by design", () => {
  test("may use the phrases freely", () => {
    w(`${P}/skills/browser-verify/SKILL.md`, skill("browser-verify", "> **Claude Code only.**\n\nOpen Claude in Chrome."));
    w(`${P}/commands/verify.md`, "---\ndescription: Test it in Claude in Chrome\n---\nRun the `browser-verify` skill.\n");
    assert.deepEqual(validate(root), []);
  });

  test("must say so near the top", () => {
    w(`${P}/skills/browser-verify/SKILL.md`, skill("browser-verify", "Open Claude in Chrome."));
    assert.equal(errorsMatching(/browser-verify.*Claude Code only/).length, 1);
  });

  test("the deliver skill must also declare its Claude-only parts", () => {
    w(`${P}/skills/deliver/SKILL.md`, skill("deliver", "Run it anywhere."));
    assert.equal(errorsMatching(/deliver.*Claude Code only/).length, 1);
  });

  test("a declaration buried far down does not count", () => {
    const filler = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");
    w(`${P}/skills/deliver/SKILL.md`, skill("deliver", `${filler}\n\n> Cloud delivery is Claude Code only.`));
    assert.equal(errorsMatching(/deliver.*Claude Code only/).length, 1);
  });
});

describe("references to Claude-provided commands", () => {
  test("fail outside a note", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Run the `simplify` skill afterwards."));
    assert.equal(errorsMatching(/alpha.*`simplify`.*Claude-provided/).length, 1);
  });

  test("pass inside a Claude Code note", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Tidy up (Claude Code: the `simplify` skill)."));
    assert.deepEqual(validate(root), []);
  });

  test("pass in an attribution line crediting an upstream skill of the same name", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Adapted from Matt Pocock's `code-review` skill (MIT)."));
    assert.deepEqual(validate(root), []);
  });

  test("a made-up skill is still reported as missing", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Use the `no-such-thing` skill."));
    assert.equal(errorsMatching(/does not exist/).length, 1);
  });
});

describe("the real repo", () => {
  test("validates clean under the neutral wording rules", () => {
    assert.deepEqual(validate(REPO_ROOT), []);
  });

  test("the Claude-only skills declare it up front", () => {
    for (const rel of ["skills/browser-verify/SKILL.md", "skills/deliver/SKILL.md"]) {
      const top = readFileSync(join(REPO_ROOT, "plugins/team-skills", rel), "utf8")
        .replace(/^---[\s\S]*?\n---/, "")
        .split("\n")
        .slice(0, 16)
        .join("\n");
      assert.match(top, /Claude Code only/i, rel);
    }
  });

  test("review-changes keeps both Claude commands, but as notes", () => {
    const text = readFileSync(join(REPO_ROOT, "plugins/team-skills/skills/review-changes/SKILL.md"), "utf8");
    assert.match(text, /\(Claude Code:[^)]*`\/code-review`/s);
    assert.match(text, /\(Claude Code:[^)]*`\/security-review`/s);
  });
});

describe("the context file is AGENTS.md", () => {
  test("a skill that tells the reader to use CLAUDE.md is flagged", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Refresh `CLAUDE.md` first, in the same change."));
    const errs = errorsMatching(/alpha\/SKILL\.md:\d+.*AGENTS\.md/);
    assert.equal(errs.length, 1, errs.join("\n"));
  });

  test("references and commands are checked too", () => {
    w(`${P}/references/notes.md`, "Read `CLAUDE.md` before starting.\n");
    w(`${P}/commands/ctx.md`, "---\ndescription: d\n---\nWrite CLAUDE.md now.\n");
    assert.equal(errorsMatching(/references\/notes\.md:1.*AGENTS\.md/).length, 1);
    assert.equal(errorsMatching(/commands\/ctx\.md:4.*AGENTS\.md/).length, 1);
  });

  test("a paragraph explaining the one-line import is fine", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "`CLAUDE.md` holds only the line `@AGENTS.md`, so Claude Code loads the same file."));
    assert.deepEqual(validate(root), []);
  });

  test("a paragraph explaining the fallback for unmigrated projects is fine", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Read AGENTS.md, falling back to `CLAUDE.md` in a project that has\nnot migrated."));
    w(`${P}/skills/beta/SKILL.md`, skill("beta", "An unmigrated project keeps its context in `CLAUDE.md`."));
    assert.deepEqual(validate(root), []);
  });

  test("the marker must be in the same paragraph, not elsewhere in the file", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Mention `@AGENTS.md` here.\n\nThen refresh `CLAUDE.md` before you push."));
    assert.equal(errorsMatching(/alpha\/SKILL\.md:\d+.*AGENTS\.md/).length, 1);
  });

  test("the tool contracts reference may discuss CLAUDE.md freely", () => {
    w(`${P}/references/agent-tool-contracts.md`, "Codex does not read `CLAUDE.md`.\n");
    assert.deepEqual(validate(root), []);
  });

  test("AGENTS.md mentions are of course fine", () => {
    w(`${P}/skills/alpha/SKILL.md`, skill("alpha", "Refresh `AGENTS.md` in the same change."));
    assert.deepEqual(validate(root), []);
  });

  test("the real plugin has no stray instruction to use CLAUDE.md", () => {
    const stray = validate(REPO_ROOT).filter((e) => /AGENTS\.md/.test(e));
    assert.deepEqual(stray, []);
  });
});
