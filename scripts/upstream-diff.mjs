#!/usr/bin/env node
/**
 * Compares a checkout of upstream (Matt Pocock's `skills`, MIT) against the
 * baseline recorded in `upstream.json` — the content hash of every upstream
 * file we adapted — and reports what moved since we last looked.
 *
 * Our skills are adapted copies, so upstream changes never reach us on their
 * own. This turns "someone must remember to look" into a weekly report (see
 * .github/workflows/upstream-sync.yml). It never edits a skill: adapting a
 * change is a judgment call that goes through the normal release flow.
 *
 *   node scripts/upstream-diff.mjs <upstream-checkout>                 # report
 *   node scripts/upstream-diff.mjs <upstream-checkout> --write-baseline # after porting
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

/** sha256 of every file under each given directory, keyed by path from `root`. */
export function hashTree(root, dirs) {
  const out = {};
  for (const d of dirs) {
    const abs = join(root, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs).sort()) {
      out[relative(root, file).split("\\").join("/")] = sha(readFileSync(file));
    }
  }
  return out;
}

/** Skill directories (those holding a SKILL.md) one level under skills/<group>/. */
const skillDirs = (root) => {
  const base = join(root, "skills");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((g) => g.isDirectory())
    .flatMap((g) =>
      readdirSync(join(base, g.name), { withFileTypes: true })
        .filter((s) => s.isDirectory() && existsSync(join(base, g.name, s.name, "SKILL.md")))
        .map((s) => `skills/${g.name}/${s.name}`)
    );
};

const under = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

export function compareUpstream(baseline, upstreamRoot) {
  const ported = baseline.ported.map((p) => p.upstream);
  const now = hashTree(upstreamRoot, ported);
  const ownerOf = (file) => baseline.ported.find((p) => under(file, p.upstream))?.ours;

  const changed = Object.keys(now)
    .filter((f) => baseline.hashes[f] !== now[f])
    .sort()
    .map((file) => ({ file, ours: ownerOf(file) }));
  const removed = Object.keys(baseline.hashes)
    .filter((f) => !(f in now))
    .sort();
  const added = skillDirs(upstreamRoot).filter(
    (d) => !ported.some((p) => under(d, p)) && !baseline.ignored.some((i) => under(d, i))
  );

  return { clean: !changed.length && !removed.length && !added.length, changed, removed, added };
}

export function renderReport(result, baselineVersion) {
  if (result.clean) return "";
  const lines = [
    `Upstream (mattpocock/skills) has moved since we ported from **${baselineVersion}**.`,
    "",
    "Review each, adopt what helps (keeping our autonomous-mode adaptations),",
    "release through the normal flow, then refresh the baseline with",
    "`node scripts/upstream-diff.mjs <checkout> --write-baseline`.",
    "",
  ];
  if (result.changed.length) {
    lines.push("### Changed or new files in skills we ported", "");
    const bySkill = new Map();
    for (const c of result.changed) {
      bySkill.set(c.ours ?? "?", [...(bySkill.get(c.ours ?? "?") ?? []), c.file]);
    }
    for (const [ours, files] of bySkill) {
      lines.push(`- **${ours}**`, ...files.map((f) => `  - \`${f}\``));
    }
    lines.push("");
  }
  if (result.removed.length) {
    lines.push("### Removed or renamed upstream", "", ...result.removed.map((f) => `- \`${f}\``), "");
  }
  if (result.added.length) {
    lines.push(
      "### New upstream skills (not ported, not on the ignore list)",
      "",
      ...result.added.map((d) => `- \`${d}\``),
      "",
      "Port it, or add it to `ignored` in `upstream.json` with a reason.",
      ""
    );
  }
  return lines.join("\n");
}

const main = () => {
  const [, , dirArg, flag] = process.argv;
  if (!dirArg) {
    console.error("usage: upstream-diff.mjs <upstream-checkout> [--write-baseline]");
    process.exit(2);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const baselinePath = join(root, "upstream.json");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const upstream = resolve(dirArg);

  if (flag === "--write-baseline") {
    const pkg = JSON.parse(readFileSync(join(upstream, "package.json"), "utf8"));
    baseline.version = pkg.version;
    baseline.hashes = hashTree(upstream, baseline.ported.map((p) => p.upstream));
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    console.error(`baseline written: ${pkg.version}, ${Object.keys(baseline.hashes).length} files`);
    return;
  }

  process.stdout.write(renderReport(compareUpstream(baseline, upstream), baseline.version));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
