/**
 * The one escalation ladder for quality findings, shared by every quality
 * wrapper: `guard-quality.mjs` (Claude Code), `cursor-guard-quality.mjs`
 * (Cursor) and the Codex wrapper. It uses the pure rules in `escalation.mjs`:
 * block with an explanation, insist, then concede on the record in
 * `.claude/engineering-overrides.md` at the git root. Without it a legitimate
 * exception could never be justified and a blocked retry would loop forever.
 *
 * Public interface
 *   applyLadder({ tool, findings, sessionId, cwd }) -> { exitCode: 0|2, stderr }
 *     tool       "claude" | "cursor" | "codex": picks the state-file prefix.
 *     findings   [{ filePath, ruleId, line, text, why }]; `filePath` as the tool
 *                spelled it (shown to the user). `guardPayload` findings fit.
 *     sessionId  the tool's session or conversation id.
 *     cwd        directory the tool works in (default process.cwd()).
 *     Write `stderr` to stderr and exit with `exitCode`.
 *   ladderStatePath(tool, sessionId) -> path of the per-session attempt counts.
 *
 * Semantics
 *   - Counts are per session, per (file, rule). The file is normalised (resolved
 *     against cwd, made relative to the git root) so `a.ts`, `./a.ts` and the
 *     absolute path are one key.
 *   - Only findings being blocked advance their counter. A rule already
 *     conceded for a file in this session is silent: not re-counted, not
 *     re-recorded. Each concession lands in the ledger once per session.
 *   - A call blocks while any finding is still below its third ask; the tone is
 *     taken from the least-argued blocked rule, so a new problem in a file
 *     under discussion still gets its full explanation.
 *   - State: the OS temp directory, `team-skills/<sessionId>.json` for claude
 *     (the historical name) and `<tool>-<sessionId>.json` for cursor and codex,
 *     so tools never collide. Never written into the user's repository except
 *     the override ledger. Persisting is best effort: a guard that cannot
 *     remember still guards.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import {
  ATTEMPTS_BEFORE_OVERRIDE,
  attemptKey,
  renderOverrideRecord,
  renderVerdict,
  verdictFor,
} from "./escalation.mjs";

const PREFIX = "[team-skills guard]";

const LEDGER_HEADER =
  "# Engineering overrides\n\n" +
  "Every time the team's quality guard was overruled, and on what. This file\n" +
  "is written by the guard, not by hand. A long list here is not a scandal —\n" +
  "it is a reading list for the next `principles-audit`, and a hint that a\n" +
  "rule may be wrong rather than the code.\n\n";

export const ladderStatePath = (tool, sessionId) => {
  const id = String(sessionId ?? "unknown").replace(/[^\w-]/g, "");
  const name = tool === "claude" ? `${id}.json` : `${tool}-${id}.json`;
  return join(tmpdir(), "team-skills", name);
};

const readState = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};

const writeState = (path, state) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state));
  } catch {
    // Failing to persist must never fail the user's edit.
  }
};

const gitRootOf = (cwd) => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};

/** Absolute, symlink-resolved (as far as the path exists) form of a file path. */
const canonical = (filePath, cwd) => {
  const abs = resolve(cwd, filePath);
  return join(real(dirname(abs)), basename(abs));
};

/** The key spelling of a file: relative to the git root, else absolute. */
const normalisedFile = (filePath, cwd, root) => {
  const abs = canonical(filePath, cwd);
  if (!root) return abs;
  const rel = relative(real(root), abs);
  return rel.startsWith("..") || isAbsolute(rel) ? abs : rel;
};

const byFile = (findings) => {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.filePath)) groups.set(f.filePath, []);
    groups.get(f.filePath).push(f);
  }
  return groups;
};

const recordOverrides = (groups, root) => {
  if (!root) return;
  const ledger = join(root, ".claude", "engineering-overrides.md");
  try {
    mkdirSync(dirname(ledger), { recursive: true });
    if (!existsSync(ledger)) writeFileSync(ledger, LEDGER_HEADER);
    const when = new Date().toISOString();
    for (const [filePath, findings] of groups) {
      appendFileSync(ledger, `${renderOverrideRecord(findings, filePath, when)}\n`);
    }
  } catch {
    // Recording is best effort.
  }
};

export function applyLadder({ tool = "claude", findings, sessionId, cwd }) {
  if (!findings || findings.length === 0) return { exitCode: 0, stderr: "" };

  const dir = cwd ?? process.cwd();
  const root = gitRootOf(dir);
  const statePath = ladderStatePath(tool, sessionId);
  const state = readState(statePath);

  const keyed = findings.map((finding) => {
    const key = attemptKey(normalisedFile(finding.filePath, dir, root), finding.ruleId);
    return { finding, key, attempts: state[key] ?? 0 };
  });

  // Already conceded earlier in this session: silent, never re-counted.
  const live = keyed.filter((k) => k.attempts < ATTEMPTS_BEFORE_OVERRIDE);
  if (live.length === 0) return { exitCode: 0, stderr: "" };

  const blocked = live.filter((k) => verdictFor(k.attempts).action === "block");
  const acting = blocked.length > 0 ? blocked : live;
  const { action, tone } = verdictFor(Math.min(...acting.map((k) => k.attempts)));

  for (const k of acting) state[k.key] = k.attempts + 1;
  writeState(statePath, state);

  const groups = byFile(acting.map((k) => k.finding));
  const message = [...groups].map(([filePath, fs]) => renderVerdict(fs, filePath, tone)).join("\n\n");

  if (action === "block") return { exitCode: 2, stderr: `${PREFIX} BLOCKED\n${message}\n` };

  recordOverrides(groups, root);
  return { exitCode: 0, stderr: `${PREFIX} ${message}\n` };
}
