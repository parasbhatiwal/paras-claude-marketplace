/**
 * Pure policy engine for the team code-quality guard.
 *
 * `engineering-principles` states these rules as prose. Prose is advice: a
 * session can always be told "just skip it", and the rule loses. This file is
 * the same rules expressed as something a machine refuses, so the standard
 * holds when nobody is feeling strict — including when the author is the one
 * asking to bend it.
 *
 * Kept free of I/O so it can be unit-tested directly; `guard-quality.mjs` is
 * the thin Claude Code hook wrapper.
 *
 * ## The escape hatch, and why there is one
 *
 * Every rule here has real exceptions. A third-party type genuinely is `any` at
 * some boundaries; a catch genuinely is empty when the fallback *is* "carry on".
 * A guard with no way through gets uninstalled, and then it protects nothing.
 *
 * So each rule can be satisfied by an adjacent comment carrying a reason:
 *
 *     // why: Fastify types this as unknown at the plugin boundary
 *     const app = server as any;
 *
 * The reason must be a real sentence, not a word. That is the whole mechanism,
 * and it is deliberate: writing down *why* is the part that makes an exception
 * a decision instead of a shortcut, and it leaves the next reader something to
 * disagree with. This mirrors `Justified-Exception:` on a commit and the
 * scoped, dated exceptions `project-rules` records.
 */

/** A justification must say something. One word is not a reason. */
const MIN_REASON = 12;

const SENTENCE = `\\S(?:.*\\S){${MIN_REASON - 1},}`;

/**
 * `why:` or `justified:` inside a comment, followed by an actual sentence.
 *
 * Matched anywhere in the line rather than anchored, so it works trailing the
 * offending code as well as on the line above it, and in every comment syntax
 * (`//`, `#`, `--`, `/* *\/`) without enumerating them.
 */
const REASON = new RegExp(`\\b(?:why|justified)\\s*:\\s*${SENTENCE}`, "i");

/**
 * A suppression that already carries its own reason.
 *
 * Biome and ESLint both have a syntax for explaining a suppression inline, and
 * a codebase using it properly is doing exactly what this guard is asking for.
 * Demanding a second `why:` beside the first would teach people that the guard
 * has not read their code — which is how a guard loses its authority.
 */
const NATIVE_REASON = new RegExp(
  `(biome-ignore\\s+\\S+\\s*:\\s*${SENTENCE}` +
    // ESLint's description separator is ` -- `, and the rule names before it
    // contain hyphens themselves (`no-console`), so this has to scan lazily
    // past them rather than stopping at the first `-`.
    `|eslint-disable[\\w-]*[^\\n]*?\\s--\\s+${SENTENCE}` +
    `|#\\s*type:\\s*ignore\\S*\\s+#\\s*${SENTENCE}` +
    `|#\\s*noqa:\\s*\\w+\\s+#\\s*${SENTENCE})`,
  "i",
);

/**
 * Comment bodies, so a rule can choose not to read them.
 *
 * Prose that *discusses* a pattern must not trip the rule about the pattern.
 * Run against a real 277-file codebase, the first draft of this guard flagged
 * a doc comment reading "Global: any feature that stores a secret" as a
 * silenced type, and a comment reading "No `.catch(() => undefined)`. Swallowing
 * here is what let a broken cleanup run 110 times unnoticed" as a swallowed
 * error. Both were the codebase being *careful*, and blocking them would have
 * been the guard punishing exactly the behaviour it exists to encourage.
 */
const COMMENT = /(\/\/.*$|#(?!\d).*$|\/\*[\s\S]*?\*\/|^\s*\*.*$|--\s.*$)/gm;

/**
 * Blanked, not deleted.
 *
 * Deleting a block comment removes its newlines with it, and every line number
 * after it in the file shifts — so the refusal points at innocent code and the
 * reader stops trusting the guard. Each character becomes a space instead,
 * which preserves both the line count and the column.
 */
const withoutComments = (text) => text.replace(COMMENT, (match) => match.replace(/[^\n]/g, " "));

/** Test files may do things production code may not, and vice versa. */
const TEST_FILE = /([.-](test|spec)\.|(^|\/)(tests?|testing|__tests__|spec)\/)/;

/** Files whose only job is configuration of a gate. */
const GATE_CONFIG =
  /(^|\/)(vitest|jest|vite|rollup|webpack|karma)\.config\.[cm]?[jt]s$|(^|\/)(tsconfig[^/]*\.json|\.eslintrc[^/]*|eslint\.config\.[cm]?[jt]s|biome\.jsonc?|\.dependency-cruiser\.[cm]?js|ruff\.toml|\.golangci\.ya?ml|pyproject\.toml|setup\.cfg|\.gitleaks\.toml|lefthook\.ya?ml|\.pre-commit-config\.ya?ml)$/;

/**
 * Every rule, as data.
 *
 * One entry per defect class so a rule can be read, tested and argued with on
 * its own — and so adding one is adding a row, not editing a function.
 *
 *   id       stable name, used in the message and in tests
 *   pattern  what makes a line suspect
 *   appliesTo optional predicate on the file path
 *   why      what the reader is told, in the imperative
 */
export const RULES = [
  {
    id: "silenced-type",
    scope: "code",
    pattern: /(:\s*any\b|\bas\s+any\b|<any>|\bany\[\]|Array<any>|\bunsafe\s*\{)/,
    why: "This silences the type checker. A weakened type hides the bug it was going to catch — model the value honestly, or record why it cannot be modelled.",
  },
  {
    id: "suppressed-check",
    // These live *in* comments, so this is the one rule that reads them.
    scope: "comment",
    pattern:
      /(@ts-expect-error|@ts-ignore|eslint-disable|biome-ignore|#\s*noqa|#\s*type:\s*ignore|\/\/\s*nolint|rubocop:disable|prettier-ignore|@SuppressWarnings|#pragma\s+warning\s+disable)/,
    why: "This turns a check off. A warning nobody must fix is noise that trains the team to ignore output — fix the code, or say in the suppression itself why the rule is wrong here.",
  },
  {
    id: "swallowed-error",
    scope: "code",
    pattern:
      /(catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:]*:\s*pass\b|rescue\s*(=>\s*\w+)?\s*(nil|\{\s*\})|\.catch\(\s*\(\s*\)\s*=>\s*(undefined|null|\{\s*\})\s*\)|_\s*[,=]\s*err\b)/,
    why: "Silence is not success. An error that vanishes here surfaces later as behaviour nobody can explain — handle it, or let it propagate with context.",
  },
  {
    id: "untracked-todo",
    scope: "comment",
    // Allowed when it names an issue, in any of the shapes teams write:
    //   TODO(#123)   TODO: #123   TODO: ABC-45   FIXME[PROJ-9]
    pattern: /\b(TODO|FIXME|XXX|HACK)\b(?!\s*[:(\[]?\s*(#\d+|[A-Z][A-Z0-9]+-\d+))/,
    why: "A TODO with no ticket is a note to nobody. Reference an issue, or do the work now.",
  },
  {
    id: "disabled-test",
    scope: "code",
    pattern:
      /\b(it|test|describe|context)\.(only|skip)\b|\b(xit|xdescribe|fit|fdescribe)\b|@Ignore\b|\bt\.Skip\(/,
    appliesTo: (path) => TEST_FILE.test(path),
    why: "`.only` silently stops every other test in the run from executing, and `.skip` quietly retires a case. Neither should reach a commit — a suite that does not run is worse than one that fails.",
  },
  {
    id: "debug-leftover",
    scope: "code",
    pattern: /\b(debugger|console\.debug|binding\.pry|byebug|var_dump\()/,
    appliesTo: (path) => !TEST_FILE.test(path),
    why: "Debug scaffolding left in shipped code. Remove it.",
  },
];

/** Numbers that gate a build: `lines: 100`, `"branches": 90`, `fail_under = 95`. */
const THRESHOLD =
  /["']?\b(thresholds?|statements|branches|functions|lines|coverage\w*|fail_under|min\w*coverage)\b["']?\s*[:=]\s*(\d+(?:\.\d+)?)/gi;

/** Severities, from strictest to slackest. Moving down this list is weakening. */
const SEVERITY = ["error", "deny", "warn", "warning", "allow", "off"];

const thresholdsIn = (text) => {
  const found = new Map();
  for (const [, key, value] of text.matchAll(THRESHOLD)) {
    found.set(key.toLowerCase(), Number(value));
  }
  return found;
};

/**
 * A gate being loosened — which can only be judged against what it was.
 *
 * This started life as a pattern match on the new text alone, and against a
 * real repository it fired nineteen times, on things like `"noEmit": false` in
 * a build tsconfig and a dependency-cruiser `exclude` for `dist/`. None of them
 * were weakening anything. The mistake was structural: "lowered" is a
 * comparison, and there is nothing to compare against in the added text alone.
 *
 * `Edit` carries the text being replaced, so the comparison is available for
 * exactly the operation that matters. A whole-file `Write` cannot be judged
 * this way and is deliberately not guessed at — `review-changes` and the
 * committed hooks cover that case.
 *
 * @returns {{ ruleId: string, line: number, text: string, why: string }[]}
 */
export function findWeakenedGates({ filePath = "", added = "", removed = "" } = {}) {
  if (!removed || !GATE_CONFIG.test(filePath)) return [];

  const findings = [];
  const before = thresholdsIn(removed);
  const after = thresholdsIn(added);

  for (const [key, was] of before) {
    const now = after.get(key);
    if (now !== undefined && now < was) {
      findings.push({
        ruleId: "weakened-gate",
        line: 0,
        text: `${key}: ${was} → ${now}`,
        why: `This lowers a gate from ${was} to ${now}. Never weaken a gate to make a build pass — fix the code, or add a scoped, dated exception with a reason (\`project-rules\`).`,
      });
    }
  }

  const severityBefore = SEVERITY.findIndex((level) => new RegExp(`["']${level}["']`, "i").test(removed));
  const severityAfter = SEVERITY.findIndex((level) => new RegExp(`["']${level}["']`, "i").test(added));
  if (severityBefore !== -1 && severityAfter > severityBefore) {
    findings.push({
      ruleId: "weakened-gate",
      line: 0,
      text: `${SEVERITY[severityBefore]} → ${SEVERITY[severityAfter]}`,
      why: "This downgrades a rule's severity. A warning nobody must fix is noise; turning a rule off is deleting it. Fix the code, or record a scoped, dated exception.",
    });
  }

  return findings;
}

/**
 * Which lines of a change break which rule.
 *
 * Only the text being *added* is judged. Reformatting a file, or deleting
 * something that already broke a rule, must not be blocked — otherwise the
 * guard punishes the person cleaning up after the person who introduced it.
 *
 * @param {{ filePath?: string, added?: string, removed?: string }} change
 * @returns {{ ruleId: string, line: number, text: string, why: string }[]}
 */
export function findViolations({ filePath = "", added = "", removed = "" } = {}) {
  const findings = findWeakenedGates({ filePath, added, removed });
  if (!added) return findings;

  const lines = added.split("\n");
  // Comments blanked rather than deleted, so line numbers still point at the
  // line the author is looking at.
  const codeOnly = withoutComments(added).split("\n");

  for (const rule of RULES) {
    if (rule.appliesTo && !rule.appliesTo(filePath)) continue;

    const haystack = rule.scope === "comment" ? lines : codeOnly;

    for (const [index, text] of haystack.entries()) {
      if (!rule.pattern.test(text)) continue;

      // Justified on this line, or on the line immediately above it. Two lines
      // is enough for a trailing comment or a comment above; more than that and
      // the reason has drifted away from the thing it explains. A suppression
      // written in its own tool's `rule: reason` form counts as justified —
      // demanding a second reason beside the first teaches people the guard has
      // not read their code.
      const previous = index > 0 ? lines[index - 1] : "";
      const here = lines[index] ?? text;
      if (REASON.test(here) || REASON.test(previous)) continue;
      if (NATIVE_REASON.test(here) || NATIVE_REASON.test(previous)) continue;

      findings.push({ ruleId: rule.id, line: index + 1, text: here.trim(), why: rule.why });
    }
  }

  return findings;
}

