# Frontend: component architecture, state, and structural accessibility

Everything else in this skill applies to a frontend as much as a backend —
boundaries, error taxonomy, no-patchwork, the non-negotiables. This file is
what is *additionally* true because a UI has two properties nothing else here
does: it renders the same handful of interaction shapes hundreds of times, and
a mistake in it is invisible to the person who made it and obvious to the
person who depends on assistive technology.

## Server state and client state are different problems

Conflating them is the most common expensive mistake, and it runs in both
directions:

- **Server state** — anything the backend owns: a fee ledger, a class roster,
  a list of pending approvals. This is cache, invalidation, refetch, request
  dedupe, and mutate-then-invalidate. Most of what a data-heavy application
  renders is this, and hand-rolling it as `useState` + `useEffect` per screen
  reproduces the same triple — loading / error / data — with a slightly
  different shape each time, which is duplication of a *rule*
  (`references/design.md`), not of characters.
- **Client state** — state the server does not, and sometimes *cannot*, own: a
  multi-step form draft, which panel is open, an offline mutation queue
  waiting to sync. Most applications have much less of this than the reflex to
  reach for a global store suggests.

**Adopt a server-state library (TanStack Query, SWR, RTK Query, or the
framework's own — Remix loaders, SolidStart, etc.) as soon as a second screen
reads data a first screen already reads**, or as soon as a mutation must
invalidate more than one place that read it. Not before: three screens each
independently fetching their own unrelated data have nothing to share yet, and
introducing the library there is solving a problem that does not exist.

**Do not adopt a global client-state store (Redux, a hand-rolled Context
store) by default.** Reach for one only when client state is genuinely shared
across a part of the tree that plain lifting or Context cannot reach
cleanly — a role switcher, a multi-step wizard spanning routes, an offline
queue. An application that adopts a global store for what is actually server
state ends up with a hand-written, worse cache layer sitting inside it, which
is the frontend version of retrofitting a ledger with live data instead of
designing it in (`references/api-and-data.md`).

**Never cache, in client state, something whose only true authority is the
server and that the client cannot even read.** A session identified by an
`httpOnly` cookie is the standing example: the client cannot read the cookie,
so any client-side "am I signed in" flag is a second, forgeable copy of a fact
only the server holds, and it will disagree with the server the moment a
second tab or an expired session exists. Ask the server (`/me`, `/session`,
whatever the equivalent is) rather than trust a flag.

## Extract a shared primitive at the third caller, not the first

The DRY discovery obligation (main skill) applies here with a size threshold
worth stating precisely, because both failure directions are common:

- **One caller**: do not extract. A `<Button variant size intent tone>` built
  for a single call site is an abstraction invented for a caller that does not
  exist yet — the same finding as a backend interface with one implementation.
- **Two callers**: usually still don't. Two might be coincidence; wait for the
  pattern to prove itself.
- **Three or more callers with the same shape**: extract now, in the change
  that creates the third one — this is exactly what `review-changes` step 6
  ("look outside the diff") exists to catch, because no single diff among the
  three ever looked like duplication on its own.

Extract the primitive, not a framework. A `<Field>` that wires a label, an
input, and their accessible association is worth building at three form
fields. A configurable `<Card>` with eleven boolean props, built because
"we'll probably need it," is not — that is designing for a hypothetical
future the YAGNI principle in the main skill already rules out.

## Accessibility is structural, or it is not reliable

Treating accessibility as a checklist verified after the fact
(`references/quality-attributes.md` has that checklist, and it still applies)
catches roughly a third of real issues by the numbers already cited there.
The other two-thirds are correctness properties of markup that nobody
re-checks on the fortieth screen a different author writes.

The fix is the same move the rest of this skill makes everywhere else:
**make correctness structural instead of remembered.** A backend does not ask
every handler to remember to filter by tenant — the database enforces it
(row-level security, or the ORM layer). A frontend should not ask every screen
to remember `htmlFor`, `aria-live`, `aria-invalid`, and focus management by
hand. Put that wiring inside the shared primitives from the section above:

- A `<Field>` that generates and wires its own id, and accepts an error to
  turn into `aria-invalid` and `aria-describedby` automatically.
- An `<Announcement>` (or equivalent live-region primitive) that owns
  `role="alert"` vs. `role="status"` and `aria-live`, so "how do we tell the
  user this failed" has one answer instead of one answer per screen author —
  and so it cannot quietly drift, the way two screens picking two different
  `data-testid`s for the same concept is itself evidence of drift already
  happening.
- A focus-management utility for anything that opens, closes, or replaces a
  view, rather than each author deciding by hand whether to move focus.

None of this replaces the manual keyboard-only and screen-reader passes on the
PR checklist (`references/quality-attributes.md`) — it reduces what depends on
someone remembering, which is the same reason a `CHECK` constraint outranks a
code comment.

## Record the decision, because silence reads as one

State management and shared-component conventions are exactly the kind of
choice the `adr` skill exists for: expensive to reverse once thirty screens
exist, and easy to arrive at by accident rather than by decision. A frontend
ADR (or an amendment to whichever ADR chose the framework) should say, at
minimum: what owns server state and why, what — if anything — owns client
state and why, and which primitives are the extraction point for forms and
announcements. If the project has no such record, that is not neutral — the
next person reading thirty screens of hand-rolled `useState` will assume
someone chose that, and build the thirty-first the same way.
