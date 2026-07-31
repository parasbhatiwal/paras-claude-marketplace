/**
 * Pure policy engine for the team git guard.
 *
 * Kept free of I/O so it can be unit-tested directly; `guard-git.mjs` is the
 * thin Claude Code hook wrapper that feeds it stdin and maps the verdict onto
 * hook exit codes.
 *
 * Every rule below answers one question: "should this Bash command be allowed
 * to run inside a Claude session?" Blocking here is a first line of defense —
 * the committed git hooks and CI re-check the same policies.
 */

/** Accounts allowed to merge their OWN pull requests. */
export const DEFAULT_SELF_MERGE_ALLOWLIST = ["parasbhatiwal"];

/** Canonical Claude co-author address. The trailer must carry it verbatim. */
export const CLAUDE_TRAILER_EMAIL = "noreply@anthropic.com";

export const parseAllowlist = (raw) =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// One shell "segment": stops at a pipe, separator, or newline so a rule can
// never match a flag belonging to a *different* command on the same line
// (`git push origin main && git log -n 5` must not read as `push -n`).
const SEG = "[^|;&\\n]*";
const re = (body, flags) => new RegExp(body, flags);

const NO_VERIFY = re(`\\bgit\\b${SEG}\\b(commit|push)\\b${SEG}(--no-verify|\\s-n\\b)`);
const FORCE_PUSH = re(`\\bgit\\b${SEG}\\bpush\\b${SEG}(--force(-with-lease)?\\b|\\s-f\\b)`);
const REWRITE = re(
  `\\bgit\\b${SEG}\\b(rebase|reset\\s+--hard|filter-branch|push\\s+${SEG}--delete)\\b`
);
const COMMIT = re(`\\bgit\\b${SEG}\\bcommit\\b`);
const PROTECTED_BRANCH = /\b(main|master)\b/;
const GH_PR_MERGE = /\bgh\s+pr\s+merge\b(?:\s+(\d+|\S*#\d+|https?:\/\/\S+))?/;

// Trailers are scanned inside a single-line command string, so match without
// anchoring — but stop at a literal `\n` escape as well as a real newline, or
// two trailers written as `...\nCo-Authored-By: ...` collapse into one match.
const CO_AUTHOR_TRAILER = /Co-Authored-By:[^\n\\]*/gi;

const isClaudeTrailer = (line) => new RegExp(CLAUDE_TRAILER_EMAIL, "i").test(line);

const allow = () => ({ action: "allow" });
const block = (reason) => ({ action: "block", reason });

/**
 * @param {string} command  the Bash command Claude is about to run
 * @param {object} deps
 * @param {() => string|null} [deps.getMerger]    resolves the current gh user
 * @param {(ref: string) => string|null} [deps.getPrAuthor]  resolves a PR author
 * @param {string[]} [deps.allowlist]             self-merge allowlist
 * @returns {{action: "allow"} | {action: "block", reason: string}}
 */
export function evaluateCommand(command, deps = {}) {
  const {
    getMerger = () => null,
    getPrAuthor = () => null,
    allowlist = DEFAULT_SELF_MERGE_ALLOWLIST,
  } = deps;

  const cmd = String(command ?? "");

  // --- PR merge policy (gh pr merge) --------------------------------------
  // Self-merge is allowed only for allowlisted owner accounts merging their
  // own PR. Anyone else's PR must be merged by a different person.
  const mergeMatch = cmd.match(GH_PR_MERGE);
  if (mergeMatch) {
    const merger = getMerger();
    const author = getPrAuthor(mergeMatch[1] ?? null);
    if (!merger || !author) {
      return block(
        "cannot verify PR author/merger identity (gh unavailable?). " +
          "Self-merge policy requires verification — retry when gh works."
      );
    }
    if (merger === author && !allowlist.includes(merger)) {
      return block(
        `self-merge not allowed: @${merger} authored this PR. ` +
          "Team rule: only the owner account may self-merge; ask a teammate to review and merge."
      );
    }
    // Fall through: a compound command may still carry a git write to check.
  }

  if (!/\bgit\b/.test(cmd)) return allow();

  // --- universal: never bypass verification -------------------------------
  // `-n` is --no-verify for commit/push; matched only within the same segment
  // as those subcommands to avoid false positives (e.g. `git log -n 5`).
  if (NO_VERIFY.test(cmd)) {
    return block(
      "git commit/push with --no-verify is not allowed. Fix the failing gate instead of bypassing it."
    );
  }

  // --- force push to protected branches ------------------------------------
  // Force-pushing a feature branch stays allowed: it still needs user approval
  // via the push-branch skill, and git hooks/CI remain the wall.
  if (FORCE_PUSH.test(cmd) && PROTECTED_BRANCH.test(cmd)) {
    return block("force-pushing to main/master is not allowed.");
  }

  // --- history rewrites on protected branches ------------------------------
  if (REWRITE.test(cmd) && PROTECTED_BRANCH.test(cmd)) {
    return block("history rewrites / deletions targeting main/master are not allowed.");
  }

  // --- commit message trailer enforcement ----------------------------------
  if (COMMIT.test(cmd)) {
    const hasInlineMessage = /\s(-m|--message)\b/.test(cmd) || /<<\s*['"]?EOF/.test(cmd);
    // -F/-t/--amend without -m: the message is not inspectable here, so the
    // committed commit-msg git hook enforces the same rule at commit time.
    if (hasInlineMessage) {
      const trailers = cmd.match(CO_AUTHOR_TRAILER) ?? [];
      const hasClaude = trailers.some(isClaudeTrailer);
      const hasHuman = trailers.some((l) => !isClaudeTrailer(l));
      if (!hasClaude || !hasHuman) {
        return block(
          "commit message must contain BOTH trailers:\n" +
            "  Co-Authored-By: <human name> <human email>   (from git config)\n" +
            `  Co-Authored-By: Claude <${CLAUDE_TRAILER_EMAIL}>\n` +
            "Use the commit-changes skill to draft a compliant message."
        );
      }
    }
  }

  return allow();
}
