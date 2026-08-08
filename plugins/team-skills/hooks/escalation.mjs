/**
 * How many times the guard says no before it gets out of the way.
 *
 * A guard that can never be overridden is a guard that gets uninstalled, and
 * then it protects nothing. A guard that folds on the first push protects
 * nothing either. So this one escalates, and there are two different ways
 * through it — deliberately different, because they mean different things:
 *
 *   **The reasoned path.** Write the exception down where the next reader will
 *   see it (`// why: …`) and the guard steps aside immediately and silently.
 *   Nobody who has articulated their reason should be made to fail three times
 *   to prove they meant it. This is the path the team wants people to use.
 *
 *   **The persistent path.** Ask again. The first refusal explains the rule;
 *   the second says what ignoring it has cost; the third lets it through and
 *   **records that it happened**. Persistence is allowed to win, but never
 *   quietly — an override nobody can see afterwards is indistinguishable from
 *   compliance, and the point of a standard is that departures from it are
 *   visible in review.
 *
 * Pure, so the ladder can be tested without touching a filesystem or a clock.
 */

/** Refusals before the same rule, on the same file, stops blocking. */
export const ATTEMPTS_BEFORE_OVERRIDE = 3;

/** One key per rule per file: arguing about `any` in `a.ts` is its own argument. */
export const attemptKey = (filePath, ruleId) => `${filePath}::${ruleId}`;

/**
 * What to do about a finding, given how many times it has already been raised.
 *
 * @param {number} priorAttempts  how many times this rule was refused for this file
 * @returns {{ action: "block" | "allow", tone: "explain" | "insist" | "concede" }}
 */
export function verdictFor(priorAttempts) {
  if (priorAttempts + 1 < ATTEMPTS_BEFORE_OVERRIDE) {
    return { action: "block", tone: priorAttempts === 0 ? "explain" : "insist" };
  }
  return { action: "allow", tone: "concede" };
}

const PREAMBLE = {
  explain: (count) =>
    count === 1
      ? "This change breaks the team's engineering standard."
      : `${count} changes here break the team's engineering standard.`,

  insist: (count) =>
    `Still ${count} problem${count === 1 ? "" : "s"} here, and this is the second time.\n` +
    "Before asking again, consider that these rules exist because each one has\n" +
    "already cost somebody a production incident or a week of archaeology. The\n" +
    "cheap fix now is almost always cheaper than the same fix later.",

  concede: () =>
    "Overriding, because you have asked three times.\n\n" +
    "This is being recorded so the choice is visible in review rather than\n" +
    "silent. If it was the right call, the record costs you nothing. If it was\n" +
    "not, the next reader can find it — which is the whole point.",
};

const EPILOGUE = {
  explain:
    "Fix the cause. If this is a genuine, deliberate exception, say so where the\n" +
    "next reader will see it — an adjacent comment carrying a real reason:\n\n" +
    "    // why: <what makes this the right call here>\n\n" +
    "A reason under 12 characters is not a reason.",

  insist:
    "Two ways forward, and they mean different things:\n\n" +
    "  1. Fix the cause. Usually smaller than it looks.\n" +
    "  2. Write the exception down — `// why: <reason>` beside the line — and\n" +
    "     it goes through immediately, with the reasoning on the record.\n\n" +
    "Asking a third time also works, and will be recorded as an override.",

  concede: "",
};

/**
 * The message the session sees.
 *
 * Every refusal states what, where and *why* — a guard that only says "not
 * allowed" teaches nothing and gets worked around rather than understood.
 */
export function renderVerdict(findings, filePath, tone) {
  const lines = [PREAMBLE[tone](findings.length)];

  if (filePath) lines.push(`  in ${filePath}`);
  lines.push("");

  for (const finding of findings) {
    lines.push(`  line ${finding.line} — ${finding.ruleId}`);
    lines.push(`    ${truncate(finding.text)}`);
    lines.push(`    ${finding.why}`);
    lines.push("");
  }

  if (EPILOGUE[tone]) lines.push(EPILOGUE[tone]);

  return lines.join("\n").trimEnd();
}

/** One line per override, appended to a file a reviewer can read. */
export function renderOverrideRecord(findings, filePath, when) {
  return findings
    .map(
      (finding) =>
        `- ${when} · \`${filePath}:${finding.line}\` · **${finding.ruleId}** · overridden after ` +
        `${ATTEMPTS_BEFORE_OVERRIDE} refusals\n  \`${truncate(finding.text, 100)}\``,
    )
    .join("\n");
}

const truncate = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
