# PR Description

Write pull request descriptions in our team's standard structure so every PR is
easy to review. Used by `open-pr`; the same shape ships as the repo's
`pull_request_template.md` so hand-opened PRs match.

## How to build it

1. Determine the base branch and get the real diff — do not guess:
   ```
   git fetch origin
   git log --oneline origin/<base>..HEAD
   git diff --stat origin/<base>...HEAD
   ```
2. Read the commits and the diff, then fill in the template below from what the
   code actually does — never invent changes that aren't in the diff.
3. Keep it tight. Reviewers skim; lead with the summary.

## Template

```markdown
## Summary

One or two sentences: what this PR does and why it exists.

## Changes

- Bullet the meaningful changes, grouped by area.
- Focus on behavior and intent, not a file-by-file restatement of the diff.
- Call out anything a reviewer should look at closely.

## Testing

- How you verified this works (commands run, flows exercised, screenshots).
- Note anything you could NOT test and why.

## Notes / risks

- Migrations, config/env changes, feature flags, or follow-up work.
- Delete this section if there's nothing to flag.
```

## Show, don't just tell

Adapted from Matt Pocock's `pr` skill (MIT; see `THIRD_PARTY_NOTICES.md`).
Skip preambles; use the project's `GLOSSARY.md` language.

- **Summary — the smallest visual that shows the change.** Logic →
  pseudocode; runtime flow → a call tree; UI → a component tree; a broad
  refactor → a shallow file tree; interaction or data flow → a Mermaid
  diagram; "what changes" → a `diff`-shaped sketch matching the topic (not the
  literal diff). Show the whole block only when most of it is new or order
  matters. One or two visuals, never all.
- **Evidence — before and after.** Screenshots are best for visual changes;
  execution evidence (the exact test now failing→passing, console output) is
  next. Show the test in pseudocode.
- **Merge Danger.** *Door:* **one-way** (destructive or hard to reverse:
  migrations, deletions, published contracts) or **two-way** (cheap to roll
  back). *Blast Radius:* one word for the scope of impact (consumers, layout,
  mobile, data), with ramifications if any.

For autonomous `deliver` PRs, add: **Delivered**, **Decisions the agent
made**, **Not delivered**, **Environment friction** (anything that slowed the
run that a `retro` would fix).

## Rules

- The **Summary** must let a reviewer understand the PR without reading the diff.
- Under **Changes**, describe *why* a change was made when it isn't obvious.
- **Testing** is required — "did not test" is an acceptable answer, an empty
  section is not.
- Link related issues with `Closes #<n>` / `Refs #<n>` when applicable.
- Match the title to our commit convention (see the `conventional-commits`
  skill), e.g. `feat(cart): add quantity stepper`.
