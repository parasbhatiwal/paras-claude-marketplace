import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hashTree,
  compareUpstream,
  renderReport,
} from "../scripts/upstream-diff.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let up;
const put = (rel, body) => {
  mkdirSync(dirname(join(up, rel)), { recursive: true });
  writeFileSync(join(up, rel), body);
};

beforeEach(() => {
  up = mkdtempSync(join(tmpdir(), "upstream-"));
});
afterEach(() => rmSync(up, { recursive: true, force: true }));

const baseline = (over = {}) => ({
  version: "1.0.0",
  ported: [{ upstream: "skills/engineering/triage", ours: "triage" }],
  ignored: ["skills/misc", "skills/productivity/teach"],
  hashes: {},
  ...over,
});

describe("hashTree", () => {
  test("hashes every file under a ported skill directory, keyed by relative path", () => {
    put("skills/engineering/triage/SKILL.md", "a");
    put("skills/engineering/triage/AGENT-BRIEF.md", "b");
    put("skills/engineering/other/SKILL.md", "c");
    const h = hashTree(up, ["skills/engineering/triage"]);
    assert.deepEqual(Object.keys(h).sort(), [
      "skills/engineering/triage/AGENT-BRIEF.md",
      "skills/engineering/triage/SKILL.md",
    ]);
  });

  test("is stable for equal content and different for changed content", () => {
    put("skills/engineering/triage/SKILL.md", "a");
    const first = hashTree(up, ["skills/engineering/triage"]);
    put("skills/engineering/triage/SKILL.md", "a");
    assert.deepEqual(hashTree(up, ["skills/engineering/triage"]), first);
    put("skills/engineering/triage/SKILL.md", "a2");
    assert.notDeepEqual(hashTree(up, ["skills/engineering/triage"]), first);
  });
});

describe("compareUpstream", () => {
  const setup = () => {
    put("skills/engineering/triage/SKILL.md", "v1");
    return baseline({ hashes: hashTree(up, ["skills/engineering/triage"]) });
  };

  test("reports nothing when upstream matches the baseline", () => {
    const b = setup();
    const r = compareUpstream(b, up);
    assert.deepEqual(r.changed, []);
    assert.deepEqual(r.removed, []);
    assert.deepEqual(r.added, []);
    assert.equal(r.clean, true);
  });

  test("reports a ported file whose content changed, with the skill that owns it", () => {
    const b = setup();
    put("skills/engineering/triage/SKILL.md", "v2");
    const r = compareUpstream(b, up);
    assert.equal(r.clean, false);
    assert.deepEqual(r.changed, [{ file: "skills/engineering/triage/SKILL.md", ours: "triage" }]);
  });

  test("reports a ported file that upstream deleted or renamed", () => {
    const b = setup();
    rmSync(join(up, "skills/engineering/triage/SKILL.md"));
    assert.deepEqual(compareUpstream(b, up).removed, ["skills/engineering/triage/SKILL.md"]);
  });

  test("reports a new file inside a ported skill directory", () => {
    const b = setup();
    put("skills/engineering/triage/NEW.md", "x");
    assert.deepEqual(compareUpstream(b, up).changed.map((c) => c.file), [
      "skills/engineering/triage/NEW.md",
    ]);
  });

  test("reports a brand-new upstream skill that is neither ported nor deliberately ignored", () => {
    const b = setup();
    put("skills/engineering/shiny/SKILL.md", "new");
    put("skills/misc/ignored-thing/SKILL.md", "x");
    put("skills/productivity/teach/SKILL.md", "x");
    assert.deepEqual(compareUpstream(b, up).added, ["skills/engineering/shiny"]);
  });
});

describe("renderReport", () => {
  test("is empty when clean, and names every skill to review otherwise", () => {
    assert.equal(renderReport({ clean: true, changed: [], removed: [], added: [] }, "1.0.0"), "");
    const md = renderReport(
      {
        clean: false,
        changed: [{ file: "skills/engineering/triage/SKILL.md", ours: "triage" }],
        removed: [],
        added: ["skills/engineering/shiny"],
      },
      "1.0.0"
    );
    assert.match(md, /1\.0\.0/);
    assert.match(md, /triage/);
    assert.match(md, /shiny/);
  });
});

describe("the committed baseline", () => {
  const b = JSON.parse(readFileSync(join(ROOT, "upstream.json"), "utf8"));

  test("records the version it was ported from and pins every ported file", () => {
    assert.match(b.version, /^\d+\.\d+\.\d+$/);
    assert.ok(Object.keys(b.hashes).length > 20);
  });

  test("maps only to skills that exist in this plugin", () => {
    for (const p of b.ported) {
      assert.ok(
        existsSync(join(ROOT, "plugins/team-skills/skills", p.ours, "SKILL.md")),
        `${p.upstream} -> ${p.ours} does not exist`
      );
    }
  });
});
