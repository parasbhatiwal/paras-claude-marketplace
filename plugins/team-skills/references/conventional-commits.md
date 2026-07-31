# Conventional Commits

Write every commit message in our team's Conventional Commits format. Used by
`commit-changes` (message drafting), `open-pr` (PR titles), and `release`
(version derivation and changelog).

## Format

```
<type>(<optional-scope>): <subject>

<optional body>

<optional footer>
```

## Types

Use one of these, lowercase:

- `feat` — a new user-facing feature
- `fix` — a bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — a performance improvement
- `docs` — documentation only
- `test` — adding or fixing tests
- `chore` — tooling, deps, or housekeeping with no product impact
- `ci` — CI/CD config and pipelines
- `build` — build system or external dependencies
- `style` — formatting/whitespace only (no logic change)

## Rules

- **Scope** is optional and goes in parentheses — use the affected area
  (e.g. `feat(auth):`, `fix(mobile):`, `fix(config):`). Keep it short and
  lowercase.
- **Subject** is imperative mood, lowercase, no trailing period, ≤ 72 chars.
  Write "add", not "added" or "adds".
- **Body** is optional. Add it when the *why* isn't obvious from the subject.
  Wrap at ~72 chars. Explain motivation and contrast with previous behavior,
  not the mechanics of the diff.
- **Breaking changes**: append `!` after the type/scope (`feat(api)!:`) and add
  a `BREAKING CHANGE:` footer describing the migration.
- One logical change per commit. If a diff spans unrelated concerns, split it.

## Examples

```
feat(cart): add quantity stepper to line items
fix(mobile): stop sticky action bar from covering the footer
refactor(config): centralize env var fallbacks
chore(deps): bump next to latest patch
```

## Before committing

1. Review the staged diff and pick the single `type` that best describes it.
2. Draft the subject in imperative mood.
3. Add a body only if it adds information the subject can't carry.
4. Never commit unrelated changes together — stage selectively.
