/**
 * The quality guard refuses work, so its false positives cost more than its
 * misses: a guard that blocks legitimate code gets uninstalled, and then it
 * protects nothing. Roughly half the cases below assert that something is
 * ALLOWED, and that is deliberate.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findViolations, RULES } from "../plugins/team-skills/hooks/quality.mjs";

const violate = (added, filePath = "src/thing.ts") =>
  findViolations({ filePath, added }).map((finding) => finding.ruleId);

describe("silencing the type checker", () => {
  it("refuses an `any` annotation", () => {
    assert.deepEqual(violate("const actor: any = resolve();"), ["silenced-type"]);
  });

  it("refuses an `as any` cast, a `<any>` assertion and an `any[]`", () => {
    assert.deepEqual(violate("const a = x as any;"), ["silenced-type"]);
    assert.deepEqual(violate("const b = <any>x;"), ["silenced-type"]);
    assert.deepEqual(violate("let c: any[] = [];"), ["silenced-type"]);
  });

  it("allows a word that merely contains `any`", () => {
    // The rule has to survive ordinary prose and ordinary identifiers, or it
    // fires on `company`, `many`, `anyOf` and every comment ever written.
    assert.deepEqual(violate("const company = { manyThings: true };"), []);
    assert.deepEqual(violate("const schema = z.union([anyOf, other]);"), []);
  });

  it("does not read prose that merely mentions the pattern", () => {
    // Found by running this guard over a real 277-file repository: a doc
    // comment reading "Global: any feature that stores a secret needs it" was
    // flagged as a silenced type. The codebase was being careful and the guard
    // punished it, which is how a guard loses the room.
    assert.deepEqual(violate("/** Global: any feature that stores a secret needs it. */"), []);
    assert.deepEqual(violate("// the ledger accepts any of three shapes"), []);
  });
});

describe("turning a check off", () => {
  it("refuses an unexplained suppression", () => {
    assert.deepEqual(violate("// eslint-disable-next-line no-console"), ["suppressed-check"]);
    assert.deepEqual(violate("// biome-ignore lint/style/noVar"), ["suppressed-check"]);
    assert.deepEqual(violate("import x  # noqa", "src/a.py"), ["suppressed-check"]);
    assert.deepEqual(violate("// @ts-expect-error\nfoo();"), ["suppressed-check"]);
  });

  it("accepts a suppression that already explains itself in its own syntax", () => {
    // Biome and ESLint both have a way to carry the reason. A codebase using it
    // is doing what this guard asks; demanding a second `why:` beside the first
    // would say the guard had not read the code.
    assert.deepEqual(
      violate("// biome-ignore lint/security/noSecrets: a hash of a password nobody holds"),
      [],
    );
    assert.deepEqual(
      violate("// eslint-disable-next-line no-console -- the CLI prints its report here"),
      [],
    );
  });

  it("still refuses one whose stated reason says nothing", () => {
    assert.deepEqual(violate("// biome-ignore lint/style/noVar: fix"), ["suppressed-check"]);
  });
});

describe("swallowing an error", () => {
  it("refuses an empty catch, in several languages", () => {
    assert.deepEqual(violate("try { go(); } catch {}"), ["swallowed-error"]);
    assert.deepEqual(violate("try { go(); } catch (error) {}"), ["swallowed-error"]);
    assert.deepEqual(violate("except ValueError: pass", "src/a.py"), ["swallowed-error"]);
    assert.deepEqual(violate("go().catch(() => undefined)"), ["swallowed-error"]);
  });

  it("allows a catch that actually does something", () => {
    assert.deepEqual(violate("try { go(); } catch (error) { logger.error(error); }"), []);
  });
});

describe("a TODO nobody will ever find", () => {
  it("refuses one with no ticket", () => {
    assert.deepEqual(violate("// TODO: make this faster"), ["untracked-todo"]);
    assert.deepEqual(violate("// FIXME handle the empty case"), ["untracked-todo"]);
  });

  it("allows one that names an issue", () => {
    assert.deepEqual(violate("// TODO(#412): make this faster"), []);
    assert.deepEqual(violate("// TODO: PROJ-88 handle the empty case"), []);
  });
});

describe("a test that does not run", () => {
  it("refuses `.only`, which silently disables every other test", () => {
    assert.deepEqual(violate("it.only('works', () => {})", "src/a.spec.ts"), ["disabled-test"]);
    assert.deepEqual(violate("describe.skip('money', () => {})", "src/a.test.ts"), [
      "disabled-test",
    ]);
  });

  it("says nothing about production code that happens to match", () => {
    // `.only` is a test-runner idiom. Production code containing the letters
    // is not the same defect, and blocking it would be noise.
    assert.deepEqual(violate("const first = rows.only;"), []);
  });
});

describe("debug scaffolding", () => {
  it("refuses it in production code", () => {
    assert.deepEqual(violate("debugger;"), ["debug-leftover"]);
  });

  it("allows it in a test, where stepping through is the job", () => {
    assert.deepEqual(violate("debugger;", "src/a.spec.ts"), []);
  });
});

describe("weakening a gate", () => {
  const config = "vitest.config.ts";
  const change = (removed, added, filePath = config) =>
    findViolations({ filePath, removed, added }).map((finding) => finding.ruleId);

  it("refuses a lowered coverage threshold", () => {
    assert.deepEqual(change("lines: 100,", "lines: 80,"), ["weakened-gate"]);
  });

  it("allows a raised one, which is the whole point of a ratchet", () => {
    assert.deepEqual(change("lines: 80,", "lines: 100,"), []);
  });

  it("refuses a rule downgraded from error to warning or off", () => {
    assert.deepEqual(change('"noExplicitAny": "error"', '"noExplicitAny": "warn"'), [
      "weakened-gate",
    ]);
    assert.deepEqual(change('"noExplicitAny": "error"', '"noExplicitAny": "off"'), [
      "weakened-gate",
    ]);
  });

  it("allows a rule being tightened", () => {
    assert.deepEqual(change('"noExplicitAny": "warn"', '"noExplicitAny": "error"'), []);
  });

  it("says what it was and what it became, so the refusal is arguable", () => {
    const [finding] = findViolations({ filePath: config, removed: "lines: 100,", added: "lines: 80," });
    assert.match(finding.text, /lines: 100 → 80/);
  });

  it("leaves ordinary config edits alone", () => {
    // The first draft matched `exclude`, `false` and any number in a config
    // file. Over a real repository that fired nineteen times — on a build
    // tsconfig's `"noEmit": false` and a dependency-cruiser `exclude` for
    // `dist/` — and not once on an actual weakening. "Lowered" is a comparison;
    // there is nothing to compare against in the new text alone.
    assert.deepEqual(change("exclude: ['dist']", "exclude: ['dist', 'coverage']"), []);
    assert.deepEqual(change('"noEmit": true', '"noEmit": false', "tsconfig.build.json"), []);
  });

  it("says nothing about a threshold changed in ordinary source", () => {
    assert.deepEqual(change("lines: 100,", "lines: 80,", "src/report.ts"), []);
  });
});

describe("the escape hatch", () => {
  it("accepts a reason on the same line", () => {
    assert.deepEqual(
      violate("const app = server as any; // why: Fastify types the plugin boundary as unknown"),
      [],
    );
  });

  it("accepts a reason on the line above", () => {
    assert.deepEqual(
      violate("// why: the vendor client has no types at this boundary\nconst c: any = make();"),
      [],
    );
  });

  it("accepts `justified:` as well, since teams write it either way", () => {
    assert.deepEqual(violate("catch {} // justified: absence is the expected outcome here"), []);
  });

  it("refuses a reason that is not a reason", () => {
    // The point of the hatch is that somebody had to articulate the exception.
    // "why: fix" articulates nothing and would make the guard decorative.
    assert.deepEqual(violate("const a: any = x; // why: fix"), ["silenced-type"]);
    assert.deepEqual(violate("const a: any = x; // why:"), ["silenced-type"]);
  });

  it("does not let a reason two lines up cover an unrelated line", () => {
    const added = [
      "// why: the vendor client has no types at this boundary",
      "const c: any = make();",
      "const d: any = other();",
    ].join("\n");

    assert.deepEqual(violate(added), ["silenced-type"]);
  });
});

describe("what it judges", () => {
  it("judges only what is being added, never what is being removed", () => {
    // Someone deleting an `any` must not be blocked by the `any` they are
    // deleting — that punishes the cleanup and protects the mess.
    assert.deepEqual(findViolations({ filePath: "src/a.ts", added: "" }), []);
  });

  it("reports every offending line, not just the first", () => {
    const added = ["const a: any = 1;", "const b = c as any;"].join("\n");
    assert.equal(findViolations({ filePath: "src/a.ts", added }).length, 2);
  });

  it("reports the line number, so the message points somewhere", () => {
    const added = ["const ok = 1;", "const a: any = 2;"].join("\n");
    assert.equal(findViolations({ filePath: "src/a.ts", added })[0].line, 2);
  });

  it("keeps line numbers right after a block comment", () => {
    // Comments are blanked, not deleted. Deleting a block comment takes its
    // newlines with it and every line after shifts, so the refusal points at
    // innocent code — which is how a reader stops believing the guard.
    const added = ["/**", " * A note.", " * Another line.", " */", "const a: any = 1;"].join("\n");

    assert.equal(findViolations({ filePath: "src/a.ts", added })[0].line, 5);
  });
});

describe("the rule set itself", () => {
  it("gives every rule a stable id and a reason", () => {
    for (const rule of RULES) {
      assert.match(rule.id, /^[a-z]+(-[a-z]+)*$/, `${rule.id} should be kebab-case`);
      assert.ok(rule.why.length > 40, `${rule.id} should explain itself`);
    }
  });

  it("has no duplicate ids, so a message names one rule", () => {
    const ids = RULES.map((rule) => rule.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
