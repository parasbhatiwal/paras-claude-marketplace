import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = "plugins/team-skills";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const HEADING = "Workflow struggles";

const PLACES = {
  "PR description reference": `${P}/references/pr-description.md`,
  "open-pr skill": `${P}/skills/open-pr/SKILL.md`,
  "deliver skill": `${P}/skills/deliver/SKILL.md`,
  "retro skill": `${P}/skills/retro/SKILL.md`,
  "work skill": `${P}/skills/work/SKILL.md`,
  "grill skill": `${P}/skills/grill/SKILL.md`,
  "spec-and-tickets skill": `${P}/skills/spec-and-tickets/SKILL.md`,
  "handoff-gate skill": `${P}/skills/handoff-gate/SKILL.md`,
  "example pull request template": "examples/pull_request_template.md",
  README: "README.md",
};

describe("Workflow struggles section", () => {
  for (const [label, rel] of Object.entries(PLACES)) {
    test(`${label} names the heading`, () => {
      assert.ok(read(rel).includes(HEADING), `${rel} must mention "${HEADING}"`);
    });
  }

  test("PR description reference documents fields, kinds, costs, clean run, no secrets", () => {
    const t = read(PLACES["PR description reference"]);
    for (const f of ["kind", "where", "what happened", "cost", "workaround", "suggested fix"])
      assert.ok(t.includes(f), `field ${f}`);
    for (const k of ["backtrack", "ambiguity", "gate-or-hook-block", "missing-info", "tooling", "other"])
      assert.ok(t.includes(k), `kind ${k}`);
    for (const c of ["minor", "lost-time", "blocked"]) assert.ok(t.includes(c), `cost ${c}`);
    assert.ok(t.includes("None encountered"));
    assert.match(t, /never contain secrets/i);
  });

  test("deliver: record at the moment, orchestrator merges into the final PR", () => {
    const t = read(PLACES["deliver skill"]);
    assert.match(t, /at the moment/i);
    assert.match(t, /merges? (them|these|the)[^.]*final PR/i);
  });

  for (const s of ["work", "grill", "spec-and-tickets", "handoff-gate"]) {
    test(`${s} posts pre-PR struggles as an issue comment copied into the final PR`, () => {
      const t = read(`${P}/skills/${s}/SKILL.md`);
      assert.match(t, /comment/i);
      assert.match(t, /final PR/);
    });
  }

  test("retro reads the section as input", () => {
    assert.match(read(PLACES["retro skill"]), /Workflow struggles[^.]*(input|primary)/is);
  });

  test("no reference to the old section remains", () => {
    for (const rel of Object.values(PLACES)) assert.ok(!new RegExp(["Environment", "friction"].join(" "), "i").test(read(rel)), rel);
  });
});
