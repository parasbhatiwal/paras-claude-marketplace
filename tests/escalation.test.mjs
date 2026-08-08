/**
 * The ladder is the part of the guard people will actually feel, so its
 * behaviour is pinned precisely: how many times it says no, what changes in
 * the message each time, and that conceding is never silent.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATTEMPTS_BEFORE_OVERRIDE,
  attemptKey,
  renderOverrideRecord,
  renderVerdict,
  verdictFor,
} from "../plugins/team-skills/hooks/escalation.mjs";

const finding = {
  ruleId: "silenced-type",
  line: 12,
  text: "const actor: any = resolve();",
  why: "This silences the type checker and hides the bug it was going to catch.",
};

describe("how many times it says no", () => {
  it("blocks the first attempt, explaining the rule", () => {
    assert.deepEqual(verdictFor(0), { action: "block", tone: "explain" });
  });

  it("blocks the second, and insists", () => {
    assert.deepEqual(verdictFor(1), { action: "block", tone: "insist" });
  });

  it("concedes on the third, because a wall gets uninstalled", () => {
    assert.deepEqual(verdictFor(2), { action: "allow", tone: "concede" });
  });

  it("keeps conceding once it has conceded", () => {
    // Re-litigating a settled argument on every subsequent edit would make the
    // file unworkable and teach people to disable the plugin.
    assert.equal(verdictFor(7).action, "allow");
  });

  it("says out loud how many refusals that is", () => {
    assert.equal(ATTEMPTS_BEFORE_OVERRIDE, 3);
  });
});

describe("what changes between refusals", () => {
  const explain = renderVerdict([finding], "src/a.ts", "explain");
  const insist = renderVerdict([finding], "src/a.ts", "insist");
  const concede = renderVerdict([finding], "src/a.ts", "concede");

  it("always names the file, the line, the rule and the reasoning", () => {
    for (const message of [explain, insist, concede]) {
      assert.match(message, /src\/a\.ts/);
      assert.match(message, /line 12/);
      assert.match(message, /silenced-type/);
      assert.match(message, /hides the bug it was going to catch/);
    }
  });

  it("offers the written-down exception on the first refusal", () => {
    assert.match(explain, /\/\/ why:/);
  });

  it("escalates on the second rather than repeating itself", () => {
    // The same message twice reads as a broken loop and gets ignored. The
    // second refusal has to add something — here, what the rule has cost.
    assert.notEqual(explain, insist);
    assert.match(insist, /second time/i);
    assert.match(insist, /production incident|archaeology/i);
  });

  it("names both ways forward on the second, including that asking again works", () => {
    // Hiding the override would be dishonest, and a hidden escape gets found
    // anyway — usually by someone disabling the whole plugin.
    assert.match(insist, /Fix the cause/);
    assert.match(insist, /why:/);
    assert.match(insist, /third time/i);
  });

  it("says it is conceding, and that the concession is recorded", () => {
    assert.match(concede, /asked three times/i);
    assert.match(concede, /recorded|visible in review/i);
  });

  it("stops arguing once it has conceded", () => {
    // No "fix the cause" epilogue on a decision already made — that is nagging,
    // and nagging is what makes people turn a guard off.
    assert.doesNotMatch(concede, /Two ways forward/);
  });
});

describe("the override record", () => {
  it("says when, where, which rule, and what the line was", () => {
    const record = renderOverrideRecord([finding], "src/a.ts", "2026-08-08T10:00:00.000Z");

    assert.match(record, /2026-08-08T10:00:00\.000Z/);
    assert.match(record, /src\/a\.ts:12/);
    assert.match(record, /silenced-type/);
    assert.match(record, /const actor: any = resolve\(\);/);
  });

  it("writes one line per finding, so a batch is not one entry", () => {
    const record = renderOverrideRecord([finding, { ...finding, line: 20 }], "src/a.ts", "now");
    assert.equal(record.split("\n- ").length, 2);
  });
});

describe("what counts as the same argument", () => {
  it("keys on the rule and the file together", () => {
    // Arguing about `any` in one file should not spend the budget for a
    // different rule, or for the same rule somewhere else.
    assert.notEqual(attemptKey("a.ts", "silenced-type"), attemptKey("b.ts", "silenced-type"));
    assert.notEqual(attemptKey("a.ts", "silenced-type"), attemptKey("a.ts", "swallowed-error"));
  });
});
