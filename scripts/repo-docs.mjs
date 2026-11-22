/**
 * Repo-level checks that sit outside any plugin:
 *
 *  - Codex does not read `.claude/skills`, so each repo-level skill is exposed
 *    through a symlink in `.agents/skills`. A copy would drift, and a broken or
 *    wrong link fails silently (Codex just never sees the skill), so the link
 *    is verified. The rule applies once `.agents/skills` exists.
 *  - Relative links in the top-level docs must resolve, so a moved file cannot
 *    leave README or CONTRIBUTING pointing at nothing.
 */

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { checkContextFile } from "./neutral-wording.mjs";

/** Every `.claude/skills/<name>` needs `.agents/skills/<name>` linking to it. */
export function validateAgentSkillLinks(root, err) {
  const agentsDir = join(root, ".agents", "skills");
  const claudeDir = join(root, ".claude", "skills");
  if (!existsSync(agentsDir) || !existsSync(claudeDir)) return;

  for (const name of readdirSync(claudeDir)) {
    const source = join(claudeDir, name);
    if (!statSync(source).isDirectory()) continue;
    const label = `.agents/skills/${name}`;
    const link = join(agentsDir, name);

    let stat;
    try {
      stat = lstatSync(link);
    } catch {
      err(`${label}: missing — Codex cannot see .claude/skills/${name}; add a symlink to ../../.claude/skills/${name}`);
      continue;
    }
    if (!stat.isSymbolicLink()) {
      err(`${label}: must be a symlink to .claude/skills/${name}, not a copy (a copy drifts)`);
      continue;
    }
    let target;
    try {
      target = realpathSync(link);
    } catch {
      err(`${label}: broken symlink — it does not resolve to a directory`);
      continue;
    }
    if (target !== realpathSync(source)) {
      err(`${label}: symlink points at ${target}, not at .claude/skills/${name}`);
    }
  }

  // A link left behind after its skill was removed or renamed dangles, and
  // Codex then sees a broken skill.
  for (const name of readdirSync(agentsDir)) {
    if (existsSync(join(claudeDir, name))) continue;
    const link = join(agentsDir, name);
    let broken = false;
    try {
      realpathSync(link);
    } catch {
      broken = true;
    }
    if (broken) {
      err(`.agents/skills/${name}: stale — broken symlink with no matching .claude/skills/${name}; remove it`);
    }
  }
}

/** README, CONTRIBUTING and docs/*.md. The changelog is history and is left alone. */
function topLevelDocs(root) {
  const docs = ["README.md", "CONTRIBUTING.md"];
  const docsDir = join(root, "docs");
  if (existsSync(docsDir)) {
    for (const f of readdirSync(docsDir)) if (f.endsWith(".md")) docs.push(`docs/${f}`);
  }
  return docs.filter((rel) => existsSync(join(root, rel)));
}

/** The project context lives in AGENTS.md; these docs must not say otherwise. */
export function validateDocContextWording(root, err) {
  for (const rel of topLevelDocs(root)) {
    checkContextFile({ text: readFileSync(join(root, rel), "utf8"), rel, label: "", err });
  }
}

/** Relative markdown links (not inside code fences) must point at something that exists. */
export function validateDocLinks(root, err) {
  const docs = topLevelDocs(root);

  for (const rel of docs) {
    const file = join(root, rel);
    if (!existsSync(file)) continue;

    let inFence = false;
    for (const [i, line] of readFileSync(file, "utf8").split(/\r?\n/).entries()) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      // `[text](target)` or `[text](target "title")`
      for (const m of line.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1];
        if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) continue; // web, mailto, same-page anchor
        let path = target.split("#")[0];
        if (!path) continue;
        try {
          path = decodeURIComponent(path);
        } catch {
          // not valid percent-encoding: check it as written
        }
        if (!existsSync(resolve(dirname(file), path))) {
          err(`${rel}:${i + 1}: link to \`${path}\` does not resolve`);
        }
      }
    }
  }
}
