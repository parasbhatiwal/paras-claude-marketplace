---
name: release
description: Use this skill when cutting a release ("release this", "bump the version", "publish", "tag a version", "update the changelog"). Derives the semantic version from the conventional commits since the last tag, writes the changelog, tags, and hands off to the project's publish pipeline - asking for approval before any tag or publish.
---

# Release

Turn the commit history into a version, a changelog, and a tag. Releasing is
an outward-facing, hard-to-reverse action: it is **ask-first** at every step
that leaves the machine.

Language-agnostic: version files and publish commands come from the project's
ecosystem — resolve via `../../references/toolchains.md` (relative to this
skill's directory) and the project's `docs/engineering-rules.md`.

## Preconditions

1. On the default branch (or the designated release branch), up to date with
   the remote, working tree clean.
2. CI green on that commit — not "green on my machine". Check the actual run.
3. The full suite passes locally (`run-tests`).
4. No commits since the last tag carry an unresolved `Justified-Exception:`
   without the corresponding `break-glass` approval.

Any failure → stop and report. Never release around a red gate.

## Stage 1 — Determine the version

1. Find the last release tag (`git describe --tags --abbrev=0`) and list
   commits since it: `git log --no-merges <tag>..HEAD`.
2. Derive the bump from the conventional-commit types
   (`../../references/conventional-commits.md`, relative to this skill's
   directory):
   - any `!` or `BREAKING CHANGE:` footer → **major**
   - any `feat` → **minor**
   - otherwise `fix`/`perf` → **patch**
   - only `docs`/`chore`/`test`/`ci`/`style`/`refactor` → **no release**; say
     so rather than cutting an empty version.
3. Pre-1.0 projects: a breaking change bumps the **minor**, not the major —
   state that you are applying this rule.
4. Show the computed version and the reasoning, and **ask the user to confirm**
   before writing anything. Human judgment overrides the derivation (a `fix`
   that changes a documented behavior is breaking, whatever its type says).

## Stage 2 — Changelog

Update `CHANGELOG.md` (Keep a Changelog format), newest first:

```markdown
## [1.4.0] - 2026-07-31

### Added
- <feat subjects, rewritten for USERS, not for developers>

### Fixed
- <fix subjects>

### Changed / Deprecated / Removed / Security
- <as applicable; Security gets its own section, always>

### Breaking
- <what breaks, and the migration step — required whenever major bumps>
```

Rules:
- Write for the person upgrading. "fix(api): guard null in mapper" becomes
  "Fixed a crash when an order had no shipping address."
- Group by impact, drop pure-internal churn, never dump `git log`.
- Every breaking change gets a migration instruction, not just a description.

## Stage 3 — Version files

Update whatever the ecosystem uses — `package.json`, `pyproject.toml`,
`Cargo.toml`, `*.csproj`, `gradle.properties`, `mix.exs`, a `VERSION` file —
plus any lockfile the bump touches. Do not hand-edit a file the ecosystem's
own tool should update (`npm version`, `cargo set-version`, `poetry version`).

## Stage 4 — Commit, tag, push (ask first)

1. Commit via `commit-changes`: `chore(release): v1.4.0` with both
   `Co-Authored-By` trailers. The release commit is docs/metadata only, so the
   TDD gate does not apply — do not bundle code changes into it.
2. Show the user the version, the changelog entry, and the exact tag command.
   **Ask before tagging.**
3. Annotated tag: `git tag -a v1.4.0 -m "v1.4.0"`. Never move or delete a
   published tag — a tag is a promise. If it is wrong, release a new version.
4. Push commit and tag via `push-branch` (**asks first**).

## Stage 5 — Publish (ask first, separately)

Publishing to a registry is irreversible in practice — most registries forbid
re-using a version, and consumers may pull within seconds.

- Prefer the pipeline: if CI publishes on tag, stop here and report that the
  tag triggers it.
- Otherwise show the exact publish command and **ask again** — approval to tag
  is not approval to publish.
- After publishing: verify the artifact is actually resolvable, then create the
  release notes (`gh release create`) from the changelog entry.

## Wrap-up

Report: previous version → new version, the reasoning, the changelog entry,
the tag, whether it was published or awaits the pipeline, and any follow-ups
(deprecations to announce, docs to update, consumers to notify).

## Rules

- Never release from a dirty tree, a feature branch, or a red CI run.
- Never rewrite history to "fix" a release — roll forward.
- A release with breaking changes and no migration notes is not finished.
- If the commit history is too poor to derive a changelog from, say so and fix
  the history discipline going forward rather than inventing entries.
