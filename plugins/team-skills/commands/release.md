---
description: Cut a release — derive the version from conventional commits, write the changelog, tag, and hand off to publish
argument-hint: [optional forced version, e.g. 2.0.0]
---

Run the `release` skill.

$ARGUMENTS

Verify CI is green on the release commit first. Ask me before tagging, and ask
again before publishing — they are separate decisions.
