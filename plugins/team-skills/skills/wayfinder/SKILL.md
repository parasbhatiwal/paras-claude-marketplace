---
name: wayfinder
description: Use this skill to plan an effort too big or foggy for one agent session - a greenfield project, a huge feature, a migration - when the way to the destination is not yet visible. Charts a shared map of decision tickets on the issue tracker and resolves them one at a time until the route is clear, then hands off to spec-and-tickets. Produces decisions, not deliverables.
---

# Wayfinder

Adapted from Matt Pocock's `wayfinder` skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

A loose idea has arrived, too big for one session, wrapped in fog. Wayfinding
finds the *way*, not the destination: it charts a **shared map** on the issue
tracker and works its **decision tickets** one at a time. **Plan, don't do** —
the pull to just do the work is the signal you have reached the edge of the
map and should hand off. Where `grill` sharpens an idea one session can hold,
wayfinder is for the idea it cannot; it is slower and denser — never use it
on a well-scoped feature.

If charting finds **no fog** (the way is already clear, the journey fits one
session), there is no map: say so and go to `work`.

## The map

One issue labelled `wayfinder:map`; its child issues (GitHub sub-issues) are
the tickets. The map is an **index**, not a store — a decision lives in
exactly one place, its ticket; the map gists it and links.

```markdown
## Destination
<what reaching the end looks like: the spec, decision or change this effort
 is finding its way to. 1–2 lines; every session orients to it first.>

## Notes
<domain; skills every session should consult; standing preferences>

## Decisions so far
- [<closed ticket title>](link): <one-line gist>

## Not yet specified
<in-scope fog you cannot ticket yet; graduates as the frontier advances>

## Out of scope
<ruled beyond the destination; closed, never graduates>
```

Refer to maps and tickets **by name** (title) in everything the human reads,
never a bare `#42`.

## Tickets

Each ticket is a child issue whose body is just `## Question`, sized to one
~100K-token session, labelled `wayfinder:<type>` (the only labels they carry —
never `ready-for-agent`; these are decisions, not implementation):

- **research** (AFK) — a fact outside the repo a decision waits on → the
  `research` skill, by a subagent.
- **prototype** (HITL) — raise the fidelity with a cheap concrete artifact →
  the `prototype` skill.
- **grilling** (HITL) — conversation; the default → the `grill` skill, then
  `domain-modeling`. A HITL ticket resolves only through a live exchange;
  never answer your own questions.
- **task** (HITL or AFK) — manual work that must happen before a *decision*
  can be made (sign up, provision access, move data). The one type that does
  rather than decides; it earns its place by unblocking a decision.

**Claim** a ticket by assigning it to the driving dev, first, before any
work. Blocking uses GitHub's native dependencies
(`../../references/issue-tracker-github.md`). The **frontier** is the open,
unblocked, unclaimed children.

## Fog of war

Do not chart what you cannot yet see. *Ticket* when you can state the
question precisely now (even if you cannot answer it); *Not yet specified*
when you cannot phrase it sharply. Do not pre-slice the fog into ticket-sized
pieces. Resolving a ticket clears fog ahead of it, graduating what is now
specifiable. Scope, not sharpness, sends work to **Out of scope**: close the
ticket and leave one line (gist + why + link); it never enters Decisions so
far.

## Two modes — never resolve more than one ticket per session (research excepted)

### Chart the map (user brings a loose idea)

1. **Name the destination** — `grill` + `domain-modeling`; the destination
   fixes the scope.
2. **Map the frontier** — grill again, breadth-first: fan out across the
   whole space.
3. **Create the map** (Destination, Notes, fog in *Not yet specified*).
4. **Create the specifiable tickets**, then wire blocking edges in a **second
   pass** (ids first; a placeholder `#n` auto-links to an unrelated issue).
5. **Fire a research subagent** per research ticket, each pushing findings to
   a throwaway `research/<name>` branch (no PR) with a pointer from the ticket.
6. Stop. Charting is one session's work.

### Work the map (user brings a map)

1. Load the map (low resolution — not every ticket body).
2. Choose the ticket: the named one, else the first frontier ticket. Claim it.
3. Resolve it as its labelled type; zoom into related tickets on demand.
4. Post the answer as a resolution comment, **close**, append a context
   pointer to Decisions so far.
5. Add newly surfaced tickets, graduate fog, rule out-of-scope work out,
   delete tickets the decision invalidated. Expect concurrent sessions.

## When the map clears

**Hand off, do not build.** Merge onto the main flow at `spec-and-tickets`,
which collapses the linked decisions into a buildable plan, then
`handoff-gate` and `deliver`. Feeding the map straight into implementation
throws the linked detail away — except when the effort turned out genuinely
small.
