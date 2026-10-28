---
name: wait-what
description: Use this skill when the user says they did not follow your last message - "wait, what?", "I don't understand", "explain that again", "huh?". Re-pitches what you just said with the missing context, in plain simple English, using the project's glossary terms.
---

# Wait, what?

Adapted from Matt Pocock's `wait-what` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

The message did not land. Re-pitch it: give a little context first, then the
point, in plain **Simplified Technical English** (short sentences, one idea
each, active voice, common words), using the ubiquitous language from
`GLOSSARY.md` (follow `GLOSSARY-MAP.md` to the right context if there are
several). Do not repeat the original wording louder; assume the missing piece
was context or jargon, and supply it.

Works mid-conversation inside any other skill. The upfront cure is `grill`
with `domain-modeling`: a shared language agreed early stops the jargon from
arriving.
