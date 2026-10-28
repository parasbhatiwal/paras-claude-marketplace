---
name: handoff-gate
description: Use this skill as the last step before autonomous delivery. Tests every ticket against "could an agent finish this with zero questions?", writes the agent brief for each, and applies ready-for-agent, ready-for-human or needs-info. A ticket that fails stays out of the cloud until fixed.
---

# Handoff gate

The grill is over and the human is about to leave. This gate is the last
chance to catch what would otherwise surface as a stuck agent, or worse, a
confident wrong guess. It is deliberately adversarial: **assume the agent
will take the most literal, least-informed reading of every word.**

## For each ticket

Run the **zero-questions test**. Role-play the implementer with only the
brief, the repo, and `CLAUDE.md`:

1. Can every acceptance criterion become a failing test? If not, rewrite it.
2. Is every behavior the ticket touches specified — failure modes, edge
   cases, permissions? Name any that is not.
3. Does it need anything the cloud runner may lack (credentials, a paid
   service, a device, a manual step, a production-only resource)?
4. Does it depend on an open business question? Blocking → a blocking edge to
   that issue. Non-blocking → the default is written under *Assumptions*.
5. Are scope boundaries explicit?
6. Is it small enough for one context window? If not, return it to
   `spec-and-tickets` for splitting.

Any gap that only the human can close → **ask them now**. This is the final
time. Batch all gaps into one round, with recommended answers, and update the
brief with the answers.

## Verdict per ticket

| Result | Label | Action |
|---|---|---|
| Passes all six | `ready-for-agent` | Post the agent brief (`../../references/agent-brief.md`) |
| Needs human implementation or access the runner lacks | `ready-for-human` | Same brief, plus why an agent cannot do it |
| Open question the human cannot answer now | `needs-info` (or blocked by a `needs-business-input` issue) | Post what is established and the exact question |

Replace `needs-triage` with the verdict. Never apply `ready-for-agent`
without posting the brief in the same step.

## Epic-level checks

- The task graph has a frontier (at least one ticket can start) and no cycles.
- No `ready-for-agent` ticket is blocked only by a `ready-for-human` ticket
  nobody has scheduled — say so to the human.
- Branch protection on the default branch requires human review (check
  `gh api repos/{owner}/{repo}/branches/<default>/protection`; if absent,
  warn the human: the only wall against an agent merging to main is the
  session hook).
- The epic gets a comment summarizing: tickets and their states, the
  business issues, the assumptions, how a run is started
  (`../../references/autonomous-mode.md`).

## Output

A table: ticket, state, blockers, brief posted. Then return to `work` Stage 5.
