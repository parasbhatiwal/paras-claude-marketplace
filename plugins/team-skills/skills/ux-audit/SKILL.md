---
name: ux-audit
description: Use this skill to assess an existing product's UI/UX against modern product-design principles and produce a phased implementation plan ("redesign this", "audit the UI", "improve the UX", "modernize this dashboard/app", "this feels dated", "make this feel like a real product"). Read-only for code — it inspects the actual UI surface, audits it with cited evidence, and writes docs/ui-ux-implementation-plan.md; it never touches source files itself.
---

# UX audit (existing product)

Acts as a senior product designer / UX architect: understand what the product
is actually for, audit what exists, and hand back a plan specific enough that
`feature-ticket` can execute it screen by screen without re-deriving the
design strategy.

## Gate: does a UI surface even exist?

Before anything else, confirm there is a real visual product to audit — a
web/mobile app, a rendered dashboard, a site with layout, components, and
users who look at a screen. Grep for a frontend framework, templates, styling
system, or rendered views.

**If none exists** — the repo is a CLI, a library, an API-only service, a
collection of docs/skills/scripts, or otherwise has no screen a person looks
at — say so plainly and stop. Do not invent a design system, screens, or
components for a product that has none; a plan built on fabricated surface
area is worse than no plan, because it looks executable and isn't. If the
repo has a *docs/CLI/DX* surface instead (README, generated help text, error
messages), that is a different, narrower exercise — name it as such and ask
before treating it as this skill's target.

## When to run this, unprompted

- The user asks for a redesign, modernization, or "this looks dated" fix,
  even without naming the skill.
- A new feature adds a screen or a significant flow to an existing product —
  worth a quick audit of where it fits before `brainstorm` locks the approach.
- The product has grown organically (features bolted on over time) and no one
  has looked at the UI as a whole in a while.
- Before a redesign is scoped as engineering work — this produces the plan
  that scoping should be based on, not a vibe.

**This skill is read-only over source.** It produces a document. Implementing
the plan happens afterward through `feature-ticket` (screen by screen, each
chunk still TDD'd per `implement`), never as a drive-by edit here.

## Stage 1 — Understand the product

Inspect the codebase before proposing anything:

- **Product category**: SaaS app, dashboard, marketing site, CRM, e-commerce,
  internal tool, etc. — or a hybrid (marketing + auth + app + settings each
  need their own strategy).
- **Users**: primary persona and their goal, frequency of use, technical
  expertise; secondary personas if they exist. Identify the most frequent
  task, the most important task, the highest-risk task, and the most
  confusing one — they don't have to be the same task.
- **Tech reality**: framework, routing, component architecture, styling
  approach (CSS system, utility classes, component library), existing design
  tokens, state management, data fetching, current responsive strategy.
  Reuse what's good here — do not propose replacing working architecture
  without a specific reason tied to a UX problem it causes.
- **Prior decisions**: check the project's decision log (`docs/adr/` or
  equivalent) for anything already decided about visual/component strategy —
  a UI library, a design-token approach, a styling system — even if it was
  never fully executed. A decision found late is the same as one never found:
  the plan must build on it, not quietly recommend around it. This is the
  single highest-leverage check in this stage — missing it produces a plan
  that contradicts a decision the team already made.
- **Test surface**: read a sample of the existing UI tests and note what they
  assert on — `data-testid`/ARIA roles/text content (visual changes are
  test-safe) vs. CSS classes or DOM structure (they aren't). State this
  explicitly in the plan so `feature-ticket` knows upfront whether a purely
  visual pass risks breaking the suite.

## Stage 2 — Audit the current UI (evidence, not adjectives)

Walk the actual screens and collect **specific, cited** findings — `file:line`
or component name, what's wrong, and why it costs the user something. "Poor
hierarchy" is not a finding; "`Dashboard.tsx` renders 9 equal-weight cards
above the fold with no primary action — the one task 80% of sessions come for
is the 6th card" is.

| Area | Probes |
|---|---|
| Layout & IA | navigation matches the DB schema instead of the user's mental model; unclear primary path; competing CTAs |
| Hierarchy | everything the same visual weight; no clear "most important thing on this screen" |
| Typography/color/spacing | inconsistent scale, ad hoc one-off values, no semantic color roles |
| Components | duplicated one-off components where a shared one should exist; inconsistent states across instances of the "same" component |
| Forms | unnecessary fields, no inline validation, lost input on error, no clear submit state |
| Tables/data | every field dumped into a table with no column priority; no sort/filter/search where the data volume needs it |
| States | only the happy path designed — no loading, empty, error, or partial-data state |
| Responsive | desktop layout simply shrunk rather than re-prioritized for mobile; touch targets too small |
| Accessibility | probe against `engineering-principles`' `quality-attributes.md` (WCAG 2.2 AA baseline) rather than re-deriving the checklist here |
| Cognitive load | decorative elements with no purpose; redundant information; hidden/undiscoverable actions |

## Stage 3 — Define the target experience

Modern means **clarity, hierarchy, and restraint** — not more visual effects.
Explicitly avoid defaulting to generic templates: sidebar + topbar + four
metric cards + three charts + a big table is not a design decision, it's the
absence of one. The layout must come from what the user is actually trying to
do, prioritized by **frequency × importance × context**, not from habit.

For information architecture: navigation represents the user's mental model
of their own work, not the database's table structure.

For every major screen in the plan, define: purpose, primary user and goal,
primary action (there is exactly one), information hierarchy, components used
(prefer reuse), interaction behavior, every required state (default, loading,
empty, error, success, no-permission), responsive behavior per breakpoint, and
accessibility requirements.

Keep design-token changes proportional to the actual audit findings — do not
propose a full token/typography/color-system rewrite when the finding is "one
screen has no primary action."

## Stage 4 — Prioritize

Same scheme as `principles-audit`, applied to UX:

```
P0 — broken: the primary workflow is blocked, confusing to the point of
     failure, or inaccessible to keyboard/screen-reader users
P1 — structural: information architecture fights the user's mental model,
     no design-token consistency, core flow has no error/empty states
P2 — friction: inconsistent components, weak hierarchy, unoptimized frequent
     tasks
P3 — polish: spacing/type refinement, motion, micro-interactions
```

## Stage 5 — Write the plan

Write `docs/ui-ux-implementation-plan.md`. It is an **implementation
specification**, not a design presentation — write it so `feature-ticket` can
execute it without re-deriving strategy:

1. **Executive summary** — current experience, major problems, desired
   experience, overall direction, in terms a non-designer stakeholder can act
   on.
2. **Product understanding** — category, users, core workflows, constraints.
3. **Current UI audit** — the Stage 2 table, prioritized.
4. **UX strategy** — principles, IA, navigation, interaction philosophy for
   *this* product specifically, not generic advice.
5. **Information architecture** — proposed nav tree, with the reasoning.
6. **Screen-by-screen changes** — one section per screen per the Stage 3
   template.
7. **Component changes** — current behavior → required behavior → states →
   reuse strategy, for every component that changes.
8. **Design system changes** — only the tokens (typography/color/spacing/
   radius/shadow/icon) that the audit actually justifies changing. If the
   product is, or is stated to become, multi-tenant or white-labeled, define
   visual tokens as runtime CSS custom properties rather than compiled-in
   values (Tailwind theme constants, Sass variables) — per-tenant branding
   needs to change at runtime, not at build time. Say so explicitly even when
   the audit's other findings don't touch theming.
9. **Responsive changes** — exact desktop/tablet/mobile behavior per screen.
10. **Accessibility changes** — concrete requirements, cross-referencing
    `quality-attributes.md` rather than restating it.
11. **Performance considerations** — lazy loading, large lists, images,
    charts — only where the audit found a real cost.
12. **File-level implementation plan** — actual paths in *this* repo, each
    marked CREATE/MODIFY/DELETE with reason, changes, dependencies, expected
    result. Never invented paths — inspect the repo before writing this
    section.
13. **Implementation order** — phased, dependency-aware (tokens → layout →
    navigation → core components → primary screens → responsive → states →
    accessibility → polish → QA), sized to what a team can absorb per phase.
14. **Acceptance criteria** — measurable, per major change (e.g. "primary
    action reachable in ≤2 interactions", "no screen has competing primary
    CTAs", "all interactive elements have a visible focus state").
15. **UX quality checklist** — hierarchy, cognitive load, navigation,
    accessibility, responsive, all states, typography, color, spacing,
    component consistency, performance, mobile usability, keyboard usability.

## Stage 6 — Verify before finalizing

A plan handed to `feature-ticket` is executed close to verbatim — a wrong
code sample in it is worse than a vaguer plan, because it looks authoritative
instead of looking uncertain. Before the document is done:

- **Check every code sample against the target framework's actual semantics.**
  A token/CSS/config snippet that would not compile or would silently resolve
  to nothing (e.g. a custom property defined in terms of itself) is worse than
  no snippet — it fails in a way that looks intentional.
- **Re-read the whole plan once, end to end, for internal contradictions** —
  a design-system section that conflicts with a screen-by-screen section, an
  IA proposal that conflicts with the prior-decision check from Stage 1.

This is a self-check, not a second opinion — it does not replace a human or
`review-changes` reading the plan; it exists to catch the class of error that
looks fine until someone actually tries to use the snippet.

## Rules

- **Read-only.** This skill never edits source. The single artifact is the
  plan document; implementation happens later through `feature-ticket`.
- Evidence or it doesn't go in the report — every audit finding carries a
  citation.
- Never fabricate a UI surface, screens, or a design system for a product that
  doesn't have one — see the gate above.
- Never default to a generic template (sidebar+topbar+cards+charts+table,
  hero+3-cards+CTA) without deriving it from the actual user workflow.
- Reuse existing components and architecture where they're good; propose
  replacing them only when tied to a specific UX cost, not preference.
- Respect what's already there. Note what works, not only what's broken — a
  report that's all criticism gets dismissed, and the strengths show which
  patterns to spread.
- Don't restate `engineering-principles`' `quality-attributes.md` — reference
  it for accessibility/performance/i18n baselines instead of duplicating them.
- Motion, gradients, glassmorphism, and other visual effects appear in the
  plan only when the audit ties them to a specific usability or feedback need
  — never as default decoration.
- A recorded architecture decision on visual/component strategy always wins
  over this skill's own defaults — find it before proposing anything (Stage
  1), never after.
- Never finalize the plan without the Stage 6 self-check. Code samples in the
  plan are read as correct; verify that before handing it off.
