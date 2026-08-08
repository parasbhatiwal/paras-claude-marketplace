<!-- Copy to .github/pull_request_template.md so every PR gets this shape,
     including those opened without Claude. -->

## Summary

<!-- What this PR does and why it exists, in one or two sentences. -->

## Changes

<!-- Meaningful changes grouped by area — behavior and intent, not a
     file-by-file restatement. Call out anything to look at closely. -->

## Testing

<!-- How this was verified: commands run, flows exercised, screenshots.
     Note anything you could NOT test and why. Required — "did not test" is an
     acceptable answer, an empty section is not. -->

## Notes / risks

<!-- Migrations, config/env changes, feature flags, rollback plan, follow-ups.
     Delete if there is nothing to flag. -->

## Human verification

Two different questions, because they need two different people. Whoever
drove this change — coder or not — answers the first from using the product.
The second requires someone who can read the diff, and is not optional because
the first one is checked.

**Did you use it, and does it do what it should?**

- [ ] I ran the affected flow myself (not just the automated tests) and it
      behaved the way it is supposed to
- What I did, and what I saw:

<!-- Author fills this in, in plain terms — "I signed up as a new user, added
     two items, and the total was right" is a complete answer. Reviewers:
     reject PRs where this is empty, and never tick it on someone else's
     behalf. -->

**Has this been read by someone who can read code?**

- [ ] A qualified engineer has read the diff, not only the description
      (an automated review pass such as `review-changes` does not satisfy
      this — see its own note that a second round belongs to a human)
- Who, and what they flagged (if anyone other than the PR author):

<!-- If nobody who can evaluate the code has looked yet, say so rather than
     leaving this blank — an honest "not yet" is reviewable; silence is not. -->
