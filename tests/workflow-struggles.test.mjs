import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = "plugins/team-skills";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const REF = `${P}/references/pr-description.md`;
const HEADING = "## Workflow struggles";
const hasHeading = (t) => t.split("\n").some((l) => l.trim() === HEADING);
const skillPath = (s) => `${P}/skills/${s}/SKILL.md`;

function markdownFiles(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === "node_modules" || name.startsWith(".git")) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) markdownFiles(rel, out);
    else if (name.endsWith(".md")) out.push(rel);
  }
  return out;
}

describe("Workflow struggles section", () => {
  test("PR template and reference carry the heading", () => {
    assert.ok(hasHeading(read("examples/pull_request_template.md")));
    assert.ok(hasHeading(read(REF)));
  });

  test("reference documents fields, kinds, costs, clean run", () => {
    const t = read(REF);
    for (const f of ["**kind**", "**where**", "**what happened**", "**cost**", "**workaround**", "**suggested fix**"])
      assert.ok(t.includes(f), `field ${f}`);
    for (const k of ["backtrack", "ambiguity", "gate-or-hook-block", "missing-info", "tooling", "other"])
      assert.ok(t.includes(`\`${k}\``), `kind ${k}`);
    for (const c of ["minor", "lost-time", "blocked"]) assert.ok(t.includes(`\`${c}\``), `cost ${c}`);
    assert.ok(t.includes("None encountered"));
  });

  test("reference states the epic location and the redaction rule", () => {
    const t = read(REF);
    assert.ok(t.includes("on the epic issue, or on\n  the single issue `work` is handling"));
    assert.ok(t.includes("Noise is fine, secrets never."));
    assert.ok(t.includes("summarise error output instead of"));
    assert.ok(t.includes("private paths"));
  });

  test("reference defines the two decision sections apart", () => {
    const t = read(REF);
    assert.ok(t.includes("choices\nmade inside the brief"));
    assert.ok(t.includes("judgment calls the\nhuman must confirm"));
  });

  for (const s of ["work", "grill", "spec-and-tickets", "handoff-gate"]) {
    test(`${s} links the shared reference and the link resolves`, () => {
      const t = read(skillPath(s));
      const link = "../../references/pr-description.md";
      assert.ok(t.includes(link), `${s} must link ${link}`);
      assert.ok(existsSync(join(ROOT, P, "skills", s, link)));
      assert.ok(t.includes("Workflow struggles"));
    });
  }

  test("deliver names itself as the collector", () => {
    const t = read(skillPath("deliver"));
    assert.ok(t.includes("deliver) collects the entries"));
    assert.ok(t.includes("every sub-issue"));
    assert.ok(t.includes("at the moment it happens"));
  });

  test("retro and open-pr and README name the section", () => {
    for (const rel of [skillPath("retro"), skillPath("open-pr"), "README.md"])
      assert.ok(read(rel).includes("Workflow struggles"), rel);
  });

  test("open-pr states the body order with struggles before Human verification", () => {
    const t = read(skillPath("open-pr"));
    assert.ok(t.includes("Notes / risks, **Workflow struggles**"));
    assert.ok(t.includes("Human\n   verification last"));
  });

  test("no reference to the old section remains in any markdown file", () => {
    const old = new RegExp(["Environment", "friction"].join("\\s+"), "i");
    const files = [...markdownFiles("."), ].filter((f) => f !== "CHANGELOG.md");
    for (const rel of files) assert.ok(!old.test(read(rel)), rel);
    assert.ok(!/deliver`? friction/i.test(read("docs/skills-guide.md")));
  });
});
