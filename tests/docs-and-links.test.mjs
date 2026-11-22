import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  lstatSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

const SKILL = (name) =>
  `---\nname: ${name}\ndescription: Use this skill when you need a long enough trigger description to pass validation.\n---\n\n# ${name}\n`;

/** Minimal valid repo with one plugin and one repo-level skill. */
function scaffold(root) {
  const w = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  w(
    ".claude-plugin/marketplace.json",
    JSON.stringify({
      name: "demo-market",
      owner: { name: "Demo Owner" },
      plugins: [{ name: "demo", source: "./plugins/demo" }],
    })
  );
  w(
    "plugins/demo/.claude-plugin/plugin.json",
    JSON.stringify({ name: "demo", version: "1.0.0", description: "demo plugin" })
  );
  w("plugins/demo/skills/alpha/SKILL.md", SKILL("alpha"));
  w(".claude/skills/ship-it/SKILL.md", SKILL("ship-it"));
}

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "docs-links-"));
  scaffold(root);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const link = (name = "ship-it") => {
  mkdirSync(join(root, ".agents", "skills"), { recursive: true });
  symlinkSync(`../../.claude/skills/${name}`, join(root, ".agents", "skills", name));
};
const errorsMatching = (re) => validate(root).filter((e) => re.test(e));

describe("the real repo exposes its repo-level skills to Codex", () => {
  test("ship-change is a symlink that resolves to the Claude copy", () => {
    const link = join(REPO_ROOT, ".agents", "skills", "ship-change");
    assert.ok(lstatSync(link).isSymbolicLink(), ".agents/skills/ship-change must be a symlink");
    assert.equal(realpathSync(link), realpathSync(join(REPO_ROOT, ".claude", "skills", "ship-change")));
  });
});

describe("repo-level skill symlinks", () => {
  test("pass when every .claude skill has a resolving link", () => {
    link();
    assert.deepEqual(validate(root), []);
  });

  test("are not required when the repo has no .agents/skills directory", () => {
    assert.deepEqual(validate(root), []);
  });

  test("fail when a repo-level skill has no link", () => {
    mkdirSync(join(root, ".agents", "skills"), { recursive: true });
    assert.equal(errorsMatching(/\.agents\/skills\/ship-it.*missing/).length, 1);
  });

  test("fail when a link is broken", () => {
    link();
    rmSync(join(root, ".claude", "skills", "ship-it"), { recursive: true });
    mkdirSync(join(root, ".claude", "skills", "ship-it"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "ship-it", "SKILL.md"), SKILL("ship-it"));
    rmSync(join(root, ".agents", "skills", "ship-it"));
    symlinkSync("../../.claude/skills/gone", join(root, ".agents", "skills", "ship-it"));
    assert.equal(errorsMatching(/\.agents\/skills\/ship-it.*(broken|does not resolve)/).length, 1);
  });

  test("fail when a link points at the wrong skill", () => {
    link();
    mkdirSync(join(root, ".claude", "skills", "other"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "other", "SKILL.md"), SKILL("other"));
    rmSync(join(root, ".agents", "skills", "ship-it"));
    symlinkSync("../../.claude/skills/other", join(root, ".agents", "skills", "ship-it"));
    assert.ok(errorsMatching(/\.agents\/skills\/ship-it.*other/).length >= 1);
  });

  test("fail on a stale link whose skill was removed from .claude/skills", () => {
    link();
    mkdirSync(join(root, ".claude", "skills", "gone"), { recursive: true });
    writeFileSync(join(root, ".claude", "skills", "gone", "SKILL.md"), SKILL("gone"));
    link("gone");
    rmSync(join(root, ".claude", "skills", "gone"), { recursive: true });
    assert.equal(errorsMatching(/\.agents\/skills\/gone.*(stale|broken)/).length, 1);
  });

  test("fail when the entry is a copy rather than a link", () => {
    mkdirSync(join(root, ".agents", "skills", "ship-it"), { recursive: true });
    writeFileSync(join(root, ".agents", "skills", "ship-it", "SKILL.md"), SKILL("ship-it"));
    assert.equal(errorsMatching(/\.agents\/skills\/ship-it.*symlink/).length, 1);
  });
});

describe("relative links in the top-level docs", () => {
  const withDoc = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };

  test("pass when every relative link resolves", () => {
    withDoc("docs/guide.md", "# g\n");
    withDoc("README.md", "[guide](docs/guide.md) and [top](#top) and [web](https://example.com)\n");
    assert.deepEqual(validate(root), []);
  });

  test("fail on a README link to a missing file", () => {
    withDoc("README.md", "[gone](docs/missing.md)\n");
    assert.equal(errorsMatching(/README\.md.*docs\/missing\.md/).length, 1);
  });

  test("fail on a CONTRIBUTING link to a missing file, ignoring the anchor", () => {
    withDoc("CONTRIBUTING.md", "[x](docs/nope.md#section)\n");
    assert.equal(errorsMatching(/CONTRIBUTING\.md.*docs\/nope\.md/).length, 1);
  });

  test("resolve links in docs/ relative to that file", () => {
    withDoc("docs/a.md", "[up](../README.md)\n");
    withDoc("README.md", "# r\n");
    assert.deepEqual(validate(root), []);
  });

  test("decode percent-escapes before checking the file", () => {
    withDoc("docs/my file.md", "# f\n");
    withDoc("README.md", "[f](docs/my%20file.md)\n");
    assert.deepEqual(validate(root), []);
  });

  test("check links that carry a title", () => {
    withDoc("README.md", '[x](docs/missing.md "a title")\n');
    assert.equal(errorsMatching(/README\.md.*docs\/missing\.md/).length, 1);
    withDoc("docs/present.md", "# p\n");
    withDoc("README.md", '[x](docs/present.md "a title")\n');
    assert.deepEqual(validate(root), []);
  });

  test("ignore links inside fenced code blocks", () => {
    withDoc("README.md", "```\n[not a link](nowhere.md)\n```\n");
    assert.deepEqual(validate(root), []);
  });

  test("are not required to exist", () => {
    assert.deepEqual(validate(root), []);
  });
});

describe("README support table", () => {
  const readme = read("README.md");
  const section = readme.split(/^## /m).find((s) => s.startsWith("Works with")) ?? "";

  test("has a Works with section", () => {
    assert.ok(section, "README needs a `## Works with` section");
  });

  test("has a row per tool", () => {
    for (const tool of ["Claude Code", "Codex", "Cursor"]) {
      assert.match(section, new RegExp(`\\|[^\\n]*${tool}`), `${tool} row`);
    }
  });

  test("labels every non-Claude row best effort and never calls it verified", () => {
    const rows = section.split("\n").filter((l) => /^\|/.test(l) && /Codex|Cursor/.test(l.split("|")[1] ?? ""));
    assert.ok(rows.length >= 2);
    for (const row of rows) assert.match(row, /best effort/i, row);
    // "verified" is only allowed as part of "not verified".
    assert.doesNotMatch(section, /fully supported|(?<!not )verified/i);
    assert.match(section, /not verified by the maintainer/i);
  });

  test("documents Codex pinning to stable and the Cursor branch-pinning limit", () => {
    assert.match(section, /--ref stable/);
    assert.match(section, /cannot pin|can't pin|no (documented )?way to pin/i);
  });

  test("maps command names to skill invocations for both tools", () => {
    assert.match(section, /\$work/);
    assert.match(section, /\/work/);
  });

  test("labels Cursor hooks best effort and Codex hooks as planned", () => {
    assert.match(section, /Cursor \| All 42 \| Best effort/);
    assert.match(section, /Codex \| All 42 \| Not yet; planned/);
    assert.match(section, /guard hooks[^.]*best\s+effort on Cursor[^.]*planned, not yet available, for Codex/i);
    assert.match(section, /git\s+hooks and CI[^.]*real wall/i);
    assert.match(section, /idempotent/i);
  });
});

describe("compatibility report issue form", () => {
  const path = ".github/ISSUE_TEMPLATE/compatibility-report.yml";

  test("exists and asks for tool, version, steps and result", () => {
    assert.ok(existsSync(join(REPO_ROOT, path)), `${path} missing`);
    const form = read(path);
    for (const id of ["tool", "tool-version", "steps", "result"]) {
      assert.match(form, new RegExp(`id:\\s*${id}\\b`), `field ${id}`);
    }
    assert.match(form, /^name:/m);
    assert.match(form, /^body:/m);
  });
});

describe("contributor docs", () => {
  test("CONTRIBUTING explains the Codex symlink and its Windows caveat", () => {
    const text = read("CONTRIBUTING.md");
    assert.match(text, /\.agents\/skills/);
    assert.match(text, /symlink/i);
    assert.match(text, /Windows/);
  });
});

describe("project context template and skill", () => {
  test("the example template is AGENTS.md.template and says how to wire CLAUDE.md", () => {
    assert.ok(existsSync(join(REPO_ROOT, "examples/AGENTS.md.template")));
    assert.ok(!existsSync(join(REPO_ROOT, "examples/CLAUDE.md.template")));
    const text = read("examples/AGENTS.md.template");
    assert.match(text, /Save it as `AGENTS\.md`/);
    assert.match(text, /`@AGENTS\.md`/);
  });

  test("project-context writes AGENTS.md, asks before migrating and preserves human text", () => {
    const text = read("plugins/team-skills/skills/project-context/SKILL.md");
    assert.match(text, /Write it to `AGENTS\.md`/);
    assert.match(text, /\*\*Ask first\.\*\*/);
    assert.match(text, /byte for byte/);
    assert.match(text, /@AGENTS\.md/);
    assert.match(text, /falling\s+back to an unmigrated CLAUDE\.md/);
  });

  test("bootstrap-project points at the renamed template", () => {
    const text = read("plugins/team-skills/skills/bootstrap-project/SKILL.md");
    assert.match(text, /examples\/AGENTS\.md\.template/);
    assert.doesNotMatch(text, /CLAUDE\.md\.template/);
  });
});

describe("this repo's own context lives in AGENTS.md", () => {
  test("AGENTS.md is the managed context file and CLAUDE.md only imports it", () => {
    const agents = read("AGENTS.md");
    assert.match(agents, /<!-- claude-context:begin -->/);
    assert.match(agents, /<!-- claude-context: sha=[0-9a-f]{7,40} generated=\d{4}-\d{2}-\d{2} -->/);
    assert.match(agents, /<!-- claude-context:end -->/);
    assert.equal(read("CLAUDE.md"), "@AGENTS.md\n");
  });

  test("the freshness logic reads AGENTS.md for this repo", async () => {
    const { repositoryFacts } = await import("../plugins/team-skills/hooks/repo-facts.mjs");
    const facts = repositoryFacts(REPO_ROOT);
    assert.equal(facts.contextFile, "AGENTS.md");
    assert.match(facts.claudeMd, /claude-context: sha=/);
  });

  test("the context file records the migration gotcha for maintainers", () => {
    assert.match(read("AGENTS.md"), /older cached plugin version/i);
  });
});

describe("top-level docs name AGENTS.md as the context file", () => {
  const withDoc = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };

  test("a README that tells the reader to write CLAUDE.md is flagged", () => {
    withDoc("README.md", "Run `/context` to write your `CLAUDE.md`.\n");
    assert.equal(errorsMatching(/README\.md:1.*AGENTS\.md/).length, 1);
  });

  test("CONTRIBUTING and docs/ are checked too", () => {
    withDoc("CONTRIBUTING.md", "Refresh CLAUDE.md before pushing.\n");
    withDoc("docs/guide.md", "Then update CLAUDE.md.\n");
    assert.equal(errorsMatching(/CONTRIBUTING\.md:1.*AGENTS\.md/).length, 1);
    assert.equal(errorsMatching(/docs\/guide\.md:1.*AGENTS\.md/).length, 1);
  });

  test("an explanation of the import or fallback is fine", () => {
    withDoc("README.md", "`CLAUDE.md` is just the line `@AGENTS.md`.\n");
    assert.deepEqual(validate(root), []);
  });

  test("the changelog is history and is not checked", () => {
    withDoc("CHANGELOG.md", "- Changed how CLAUDE.md is refreshed.\n");
    assert.deepEqual(validate(root), []);
  });

  test("the real top-level docs are clean", () => {
    assert.deepEqual(validate(REPO_ROOT).filter((e) => /AGENTS\.md/.test(e)), []);
  });
});

describe("license", () => {
  test("the repo ships an MIT LICENSE under the maintainer's name", () => {
    const text = read("LICENSE");
    assert.match(text, /^MIT License/);
    assert.match(text, /Copyright \(c\) 2026 Paras Bhatiwal/);
    assert.match(text, /Permission is hereby granted, free of charge/);
    assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS"/);
  });

  test("the README states the license and links the file", () => {
    const readme = read("README.md");
    assert.match(readme, /\*\*License:\*\*[^\n]*MIT/);
    assert.match(readme, /\]\(LICENSE\)/);
  });

  test("the README says the adapted skills keep their original MIT notice", () => {
    assert.match(read("README.md"), /THIRD_PARTY_NOTICES\.md/);
  });
});
