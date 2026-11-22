/**
 * Pure staleness logic for the project's context file, kept free of I/O so it
 * can be tested. The context lives in AGENTS.md (which Claude Code, Codex and
 * Cursor can all read); CLAUDE.md is the fallback for projects that have not
 * migrated yet, and afterwards a one-line import of AGENTS.md.
 * `session-context.mjs` is the SessionStart hook that feeds it repository
 * facts and turns the verdict into additionalContext for Claude.
 *
 * The contract with the `project-context` skill is the fingerprint comment it
 * writes inside its managed region:
 *
 *   <!-- claude-context: sha=<40-hex> generated=<YYYY-MM-DD> -->
 */

/** Commits since the recorded sha that make the context suspect. */
export const COMMIT_DRIFT_THRESHOLD = 40;

/** Days after which context is re-verified even without much churn. */
export const AGE_DRIFT_DAYS = 90;

const FINGERPRINT = /<!--\s*claude-context:\s*sha=([0-9a-f]{7,40})(?:\s+generated=(\d{4}-\d{2}-\d{2}))?/i;

/**
 * Paths whose change usually invalidates written context: how the project is
 * built, run, tested, deployed, or structured.
 */
const STRUCTURAL = [
  /(^|\/)package\.json$/,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/,
  /(^|\/)(pyproject\.toml|requirements[^/]*\.txt|poetry\.lock)$/,
  /(^|\/)(go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle(\.kts)?)$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)[^/]*\.config\.(js|ts|mjs|cjs|mts)$/,
  /(^|\/)(Makefile|justfile|Dockerfile|docker-compose[^/]*\.ya?ml)$/,
  /^\.github\/workflows\//,
  /(^|\/)migrations?\//,
  /(^|\/)docs\/adr\//,
  // The context file itself (AGENTS.md or CLAUDE.md) is deliberately NOT
  // structural: the commit that writes it
  // always lands after the sha it records, so counting it would make every
  // freshly generated context immediately stale.
];

export const isStructural = (file) => STRUCTURAL.some((re) => re.test(file));

/** Candidate context files, most canonical first. */
export const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md"];

const blank = (text) => typeof text !== "string" || text.trim() === "";

/**
 * Which file the verdict is about. The first candidate carrying a fingerprint
 * wins, so a migrated project is judged by AGENTS.md even when CLAUDE.md is an
 * older managed file. Otherwise the first non-blank file is reported (as
 * unmanaged), and when none exists AGENTS.md is the file to create.
 *
 * @param {Record<string, string|null>} contents  file name -> contents or null
 * @returns {{file: string, content: string|null}}
 */
export function selectContext(contents) {
  for (const file of CONTEXT_FILES) {
    if (!blank(contents[file]) && parseFingerprint(contents[file])) {
      return { file, content: contents[file] };
    }
  }
  for (const file of CONTEXT_FILES) {
    if (!blank(contents[file])) return { file, content: contents[file] };
  }
  return { file: CONTEXT_FILES[0], content: null };
}

/** Extract the fingerprint from a context file body, or null when unmanaged. */
export function parseFingerprint(claudeMd) {
  if (typeof claudeMd !== "string") return null;
  const m = claudeMd.match(FINGERPRINT);
  if (!m) return null;
  return { sha: m[1].toLowerCase(), generated: m[2] ?? null };
}

const daysBetween = (a, b) => Math.floor((a - b) / 86_400_000);

/**
 * @param {object} facts
 * @param {string|null} facts.claudeMd        contents of the context file, null if absent
 * @param {string} [facts.contextFile]        which file that is (default CLAUDE.md)
 * @param {number} [facts.commitsSince]       commits between fingerprint sha and HEAD
 * @param {string[]} [facts.changedFiles]     files changed since the fingerprint sha
 * @param {boolean} [facts.shaKnown]          false when the recorded sha is not in this repo
 * @param {Date} [facts.now]
 * @returns {{status: "missing"|"unmanaged"|"fresh"|"stale", reasons: string[], action: string|null}}
 */
export function assessContextFreshness(facts = {}) {
  const {
    claudeMd = null,
    contextFile = "CLAUDE.md",
    commitsSince = 0,
    changedFiles = [],
    shaKnown = true,
    now = new Date(),
  } = facts;

  const file = contextFile;
  const generate = `Run the \`project-context\` skill to generate ${file} before substantial work.`;
  const refresh = `Run the \`project-context\` skill in refresh mode to bring ${file} up to date.`;

  if (claudeMd === null || claudeMd.trim() === "") {
    const none = file === "CLAUDE.md" ? "no CLAUDE.md" : `no ${file} (or CLAUDE.md)`;
    return { status: "missing", reasons: [`${none} in this repository`], action: generate, file };
  }

  const fingerprint = parseFingerprint(claudeMd);
  if (!fingerprint) {
    return {
      status: "unmanaged",
      reasons: [`${file} has no claude-context fingerprint, so drift cannot be detected`],
      action: refresh,
      file,
    };
  }

  const reasons = [];

  if (!shaKnown) {
    reasons.push(
      `the recorded commit ${fingerprint.sha.slice(0, 7)} is not in this repository ` +
        "(history rewritten or shallow clone)"
    );
  } else {
    if (commitsSince >= COMMIT_DRIFT_THRESHOLD) {
      reasons.push(`${commitsSince} commits since the context was written`);
    }
    const structural = changedFiles.filter(isStructural);
    if (structural.length) {
      const shown = structural.slice(0, 5).join(", ");
      reasons.push(
        `structural files changed since then: ${shown}` +
          (structural.length > 5 ? ` (+${structural.length - 5} more)` : "")
      );
    }
  }

  if (fingerprint.generated) {
    const age = daysBetween(now, new Date(`${fingerprint.generated}T00:00:00Z`));
    if (Number.isFinite(age) && age >= AGE_DRIFT_DAYS) {
      reasons.push(`the context is ${age} days old`);
    }
  }

  if (!reasons.length) return { status: "fresh", reasons: [], action: null };
  return { status: "stale", reasons, action: refresh, file };
}

/** Renders a verdict as the additionalContext string, or null when silent. */
export function renderNotice(verdict) {
  if (!verdict || verdict.status === "fresh") return null;
  return (
    `Project context check: ${verdict.file ?? "CLAUDE.md"} is ${verdict.status} — ` +
    `${verdict.reasons.join("; ")}. ${verdict.action} ` +
    "Mention this to the user rather than refreshing silently."
  );
}
