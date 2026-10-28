---
name: research
description: Use this skill when a decision waits on a fact outside the repo - how an API behaves, what a library supports, what a spec says. Delegates the reading to a background agent that investigates against primary sources and leaves a cited Markdown file in the repo, while you keep working.
---

# Research

Adapted from Matt Pocock's `research` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

Spin up a **background agent** so you keep working while it reads. Its job:

1. Investigate the question against **primary sources** — official docs,
   source code, specs, first-party APIs — not a secondary write-up of them.
   Follow every claim back to the source that owns it.
2. Write the findings to **one Markdown file**, citing each claim's source
   (URL + version or date, so staleness is visible).
3. Save it where the repo already keeps such notes; match the convention, or
   pick a sensible place and say where.

Unverifiable claims are marked as such, never smoothed over. The file is
material to take *into* `grill`; research feeds the thinking, it does not
replace the decision.

In a `wayfinder` map, a research ticket is resolved this way, and its findings
land on a throwaway `research/<name>` branch with a pointer from the ticket.
