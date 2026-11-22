/**
 * Keeps skills tool-neutral. The skills are shared by Claude Code, Codex and
 * Cursor, so wording that only one tool understands is written neutrally, with
 * the Claude name moved into a note of the exact form `(Claude Code: ...)`.
 *
 * Rules enforced here:
 *  - These phrases may appear in skills, commands and references ONLY inside a
 *    `(Claude Code: ...)` note: the built-in review commands, Claude in Chrome,
 *    and the Claude co-author trailer and address.
 *  - Files that are Claude-only by design are exempt, but the skills among them
 *    must say "Claude Code only" near the top so no reader is misled.
 *  - A reference to a Claude-provided command (see CLAUDE_PROVIDED_COMMANDS) is
 *    valid only inside such a note, or on an attribution line that credits an
 *    upstream skill of the same name.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Commands and skills Claude Code ships itself; a skill may name them only in a note. */
export const CLAUDE_PROVIDED_COMMANDS = new Set([
  "code-review",
  "security-review",
  "review",
  "simplify",
  "run",
  "init",
  "brainstorming",
]);

const NOTE = /\(Claude Code:[^)]*\)/g;
const ATTRIBUTION = /\bMIT\b|\b[Aa]dapted from\b/;

const PHRASES = [
  /\/code-review\b/,
  /\/security-review\b/,
  /Claude in Chrome/i,
  /Co-Authored-By:\s*Claude/i,
  /noreply@anthropic\.com/,
];

/** Files that exist because of a Claude-only feature; phrases are allowed there. */
const EXEMPT = [/^skills\/browser-verify\//, /^skills\/deliver\/SKILL\.md$/, /^commands\/verify\.md$/];
/** Skills that must declare themselves Claude-only up front. */
const MUST_DECLARE = ["skills/browser-verify/SKILL.md", "skills/deliver/SKILL.md"];
const DECLARATION_LINES = 16;

/** [start, end) offsets of every `(Claude Code: ...)` note, which may wrap lines. */
export function noteSpans(text) {
  return [...text.matchAll(NOTE)].map((m) => [m.index, m.index + m[0].length]);
}

export const inNote = (spans, index) => spans.some(([a, b]) => index >= a && index < b);

/** Blanks out notes (keeping newlines) so line numbers still line up. */
const withoutNotes = (text) =>
  text.replace(NOTE, (m) => m.replace(/[^\n]/g, " "));

/** Whether an attribution sentence sits on the same line as `index`. */
export function onAttributionLine(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return ATTRIBUTION.test(text.slice(start, end === -1 ? undefined : end));
}

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

export function validateNeutralWording({ pluginDir, label, err }) {
  const files = ["skills", "references", "commands"].flatMap((d) => markdownFiles(join(pluginDir, d)));

  for (const file of files) {
    const rel = relative(pluginDir, file);
    const text = readFileSync(file, "utf8");

    if (MUST_DECLARE.includes(rel)) {
      const top = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").split("\n").slice(0, DECLARATION_LINES).join("\n");
      if (!/Claude Code only/i.test(top)) {
        err(`${label}/${rel}: this skill is Claude-only by design; say "Claude Code only" in its first ${DECLARATION_LINES - 1} lines`);
      }
    }
    if (EXEMPT.some((re) => re.test(rel))) continue;

    withoutNotes(text)
      .split("\n")
      .forEach((line, i) => {
        for (const phrase of PHRASES) {
          const m = line.match(phrase);
          if (m) {
            err(
              `${label}/${rel}:${i + 1}: Claude-only phrase \`${m[0]}\` outside a note — ` +
                "word it neutrally and put the Claude name in a `(Claude Code: ...)` note"
            );
          }
        }
      });
  }
}
