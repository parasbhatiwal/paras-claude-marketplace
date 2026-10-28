---
name: to-questionnaire
description: Use this skill when the blocker is knowledge held by someone else - a client, an expert, a teammate - rather than anything in the codebase or your head. Interviews the user about the send (who, what you need back), then writes a questionnaire document aimed at the gap.
---

# To questionnaire

Adapted from Matt Pocock's `to-questionnaire` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

The inverse of `grill`: instead of interviewing the user about the subject,
interview them about the **send** — which they can always answer — and aim the
questions in the document at the **gap** between what the recipient knows and
what the user needs. In the v2 workflow this is the right vehicle for a
`needs-business-input` issue that needs a real stakeholder.

1. **Who is it going to?** One exchange: the recipient's role, expertise and
   relationship to the user. Done when you know who they are and what they
   know that the user does not.
2. **What do you need back?** One exchange: the specific decisions or facts
   needed. Done when there is a concrete list of what the user must be able to
   decide afterwards.
3. **Write it** to `to-questionnaire-<slug>.md` in the current directory and
   report the path. Done when every item from step 2 has a question.

## Document structure

Most-important-first (async may get only one pass); group by theme under `##`
headings once there are more than a handful.

```markdown
# <Title>
**Purpose:** why this exists and the decision riding on it.
**From:** <user>  **To:** <recipient>  **How answers will be used:** <where>

## Context
One paragraph for someone who was not in the user's head.

## How to answer
Deadline and rough effort. Partial answers and "I don't know" are useful.

## <Theme>
### <One idea, never compound>
<answer stub>
_Why this matters:_ only where it could be misread or invite a throwaway answer.
```

Answers come back as material for `grill` or `spec-and-tickets`; attach them
to the business issue and unblock the tickets it gates.
