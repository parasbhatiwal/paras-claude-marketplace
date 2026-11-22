---
name: project-context
description: Use this skill to generate or refresh a project's AGENTS.md (the context file Claude Code, Codex and Cursor read) by scanning the codebase ("set up AGENTS.md", "set up CLAUDE.md", "document this project for agents", "refresh project context", "the context is stale"), and to migrate an unmigrated CLAUDE.md into it. Produces high-signal context - commands, architecture, boundaries, conventions, gotchas - and maintains a freshness fingerprint so the file is updated when the project drifts rather than rotting silently.
---

# Project Context (AGENTS.md)

`AGENTS.md` is loaded into every session in this repo, by Claude Code, Codex and
Cursor alike. `CLAUDE.md` is only a one-line pointer to it (`@AGENTS.md`), so
there is one file to keep true. It is the highest-
leverage document in the project and the most commonly wasted one: a file full
of things a model can read off the directory tree costs context and buys
nothing.

**Write only what cannot be inferred cheaply from the code.**

This skill has three modes — **generate** (neither AGENTS.md nor an unmigrated CLAUDE.md exists, or the
one that does is unmanaged), **refresh** (a managed one has drifted) and **migrate** (a
managed CLAUDE.md moves into AGENTS.md; see below). All start by scanning; none
guesses.

## Scan before writing

Gather evidence; never assume a stack:

1. **Build/run/test commands** — from `package.json` scripts, `Makefile`,
   `pyproject.toml`, `justfile`, `docker-compose.yml`, CI workflow. **Verify
   them**: a command listed here that does not work is worse than no file at
   all. Run the test command; note how long it takes.
2. **Architecture** — entry points, bounded contexts/modules, the dependency
   direction, where the boundaries are and which ones are enforced by lint.
3. **Domain vocabulary** — the 5–15 terms that appear in code and mean
   something specific here (`Tenant`, `Booking`, `settled`, `draft`). Getting
   the ubiquitous language right prevents more mistakes than any other section.
4. **Conventions actually in use** — read the code, not the style guide:
   naming, error handling, state management, where tests live, how modules are
   exported, how config is read.
5. **External dependencies** — services, queues, third-party APIs, and which
   ones exist locally vs. are stubbed.
6. **Environment** — required env var **names** (never values), local setup
   steps, seeds/fixtures, containers needed for the integration suite.
7. **Gotchas** — the things that waste an afternoon: a generated file that
   must not be edited, a test that needs a container running, a service that
   must be started first, a directory that looks dead but is not.
8. **Recent direction** — read `git log` and `docs/adr/`: what is being
   actively built, what was recently decided, what is being migrated away
   from (and what the new way is).

## Structure to write

Write it to `AGENTS.md` at the repo root. Keep it under ~200 lines. Ruthlessly
(Codex stops reading project instructions at a size cap, so a short file is also
one every tool reads whole). Sections in this order:

```markdown
# <Project> — context for agents

<!-- claude-context:begin -->
<!-- claude-context: sha=<current HEAD sha> generated=<YYYY-MM-DD> -->

## What this is
<2–3 sentences: purpose, users, what "done" means here.>

## Commands
| Task | Command | Notes |
(dev, test, single test, lint, typecheck, build, migrate, seed)

## Architecture
<Map: contexts/modules, dependency direction, where things live and why.
 Name the enforced boundaries. Point to docs/adr/ for the reasoning.>

## Domain vocabulary
<Term — what it means HERE, especially where it differs from the obvious.>

## Conventions
<What a change should look like: patterns to follow, patterns being retired.>

## Gotchas
<Non-obvious traps, with the reason. Highest-value section in most repos.>

## Environment
<Required env var NAMES, local setup, what must be running for tests.>

## Workflow
This repo uses the team workflow: hand any task to `/go` (the `route` skill)
or `/work` - it grills the requirement first, then delivers; TDD, gated
commits. Don't start coding a task that hasn't been through the grill.
Standards: the `engineering-principles` skill.
<!-- claude-context:end -->

## Team notes
<Anything a human adds. Never rewritten by this skill.>
```

The `claude-context:begin/end` markers delimit the region this skill owns.
**Everything outside those markers is human-authored and must be preserved
verbatim on refresh.**

The fingerprint comment is what the freshness hook reads — always write the
real HEAD sha (`git rev-parse HEAD`) and today's date. The markers keep the
`claude-context` name in AGENTS.md so existing projects and hooks keep working.

`CLAUDE.md` is then a single line, `@AGENTS.md`, so Claude Code loads the same
content and nothing is written twice.

## Migrate mode — moving an unmigrated CLAUDE.md

When the repo has an unmigrated CLAUDE.md that carries a `claude-context`
fingerprint (or any hand-written content) and no AGENTS.md:

1. **Ask first.** Say what will happen: the whole file moves to AGENTS.md and
   CLAUDE.md becomes a one-line import. Do nothing until the user agrees.
2. **Move the entire file, byte for byte** — managed region, fingerprint and every
   human line outside the markers, including the Team notes. Use `git mv
   CLAUDE.md AGENTS.md` so history follows the file. Never retype or reflow it.
3. **Write the pointer.** Create a new CLAUDE.md containing exactly `@AGENTS.md`
   and a newline.
4. **Refresh** AGENTS.md as usual (below) if it has drifted, as a separate commit
   so the move itself is a pure rename.
5. If both files already exist with content, stop and ask: merging two context
   files is a human decision.

Until a project migrates, the freshness hook falls back to its CLAUDE.md, so
nothing breaks in the meantime.

## Refresh mode

1. Read the existing context file (AGENTS.md, else an unmigrated CLAUDE.md) and
   extract the recorded sha.
2. Diff the project since then: `git diff --name-only <sha>..HEAD` and
   `git log --oneline <sha>..HEAD`.
3. Update **only the sections the drift affects** — new commands, moved
   modules, changed conventions, retired patterns, new gotchas. Re-verify the
   command table regardless; commands rot first.
4. Remove what is no longer true. Stale context is worse than missing
   context: it actively misleads every future session.
5. Rewrite the fingerprint (new sha, new date). Preserve the human sections
   byte-for-byte.
6. Report a short diff summary: what changed in the context and why.

## Rules

- **No secrets.** Env var names only, never values, never example tokens that
  look real.
- **No restating the obvious.** "Uses React", "tests are in `__tests__`", or a
  directory listing wastes the budget. If `ls` answers it, leave it out.
- **Verify, don't assume.** Every command in the table must have been run or
  read from a real script. Mark anything unverified as unverified.
- **Say why, not just what.** "Do not edit `src/generated/` — regenerated by
  `npm run codegen` from the OpenAPI spec" is useful; "don't edit generated
  files" is not.
- **Prefer pointers to prose** for depth: link `docs/adr/`, the runbook, the
  API spec, rather than summarizing them here.
- Write for a reader with no history on the project and a limited window: the
  first 20 lines should let someone make a correct small change.
- If the repo already has a hand-written AGENTS.md (or an unmigrated CLAUDE.md) with no markers, do not
  clobber it: wrap or append the managed region and keep every existing line.

## Keeping it fresh

The plugin's `SessionStart` hook reads the fingerprint from AGENTS.md (falling
back to an unmigrated CLAUDE.md), compares it against the repository and nudges when the context has drifted — commits piled up since the
last refresh, structural files changed (dependencies, config, CI, migrations,
new top-level modules), or the file is simply old. When that nudge appears,
run this skill in refresh mode before doing substantial work.

Refresh manually, without waiting for the nudge, after: a dependency or
framework upgrade, a directory restructure, a new bounded context, a change in
how tests or builds are run, or an architectural ADR.
