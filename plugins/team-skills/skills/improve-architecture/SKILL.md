---
name: improve-architecture
description: Use this skill when you have spare time to keep the codebase good for agents and humans to change - or when diagnose found no seam to lock a bug down. Surfaces deepening opportunities (shallow modules that should be deep) with an HTML before/after report, then grills the chosen one into a design.
---

# Improve architecture

Adapted from Matt Pocock's architecture-improvement skill (MIT; see
`THIRD_PARTY_NOTICES.md`).

Surface architectural friction and propose **deepening opportunities** —
refactors that turn shallow modules into deep ones — for testability and
navigability. Use the `codebase-design` vocabulary exactly; use
`GLOSSARY.md` for the domain; respect `docs/adr/` (don't re-litigate).

## 1. Explore

**Scope before you scan (YAGNI).** Deepening pays off where change happens.
If the user named a direction, take it. Otherwise read `git log --oneline` a
good way back to find hot spots — files and areas that keep coming up — and
let them pull attention first.

Spawn a subagent to walk the code organically, noting friction:

- understanding one concept means bouncing between many small modules;
- **shallow** modules (interface nearly as complex as implementation);
- pure functions extracted only for testability while the real bugs hide in
  how they're called (no **locality**);
- tightly coupled modules leaking across seams;
- untested or hard-to-test parts.

Apply the **deletion test** to every suspect: "yes, it concentrates
complexity" is the signal.

## 2. Present candidates as an HTML report

A self-contained file in the OS temp dir (`$TMPDIR`, else `/tmp`), named
`architecture-review-<timestamp>.html`, so nothing lands in the repo; open it
and give the absolute path. Tailwind and Mermaid via CDN; Mermaid for
graph-shaped relationships, hand-built CSS/SVG for editorial diagrams. Each
candidate is a card: **Files**, **Problem**, **Solution** (plain English),
**Benefits** (in locality and leverage, and how tests improve), a
**before/after diagram**, and a strength badge — `Strong`, `Worth exploring`
or `Speculative`. End with a **Top recommendation**.

A candidate contradicting an ADR is shown only when the friction justifies
reopening it, marked clearly. **Do not propose interfaces yet.** Ask which to
explore.

## 3. Grill the chosen candidate

Run the `grill` skill on it: constraints, dependencies, the shape of the
deepened module, what sits behind the seam, which tests survive. Side effects
land inline via `domain-modeling`: new concept → `GLOSSARY.md`; a rejection
with a load-bearing reason → offer an ADR ("so future reviews don't
re-suggest it") — not for ephemeral reasons. To compare alternative
interfaces, use the design-it-twice procedure in `codebase-design`.

The result is an idea for the main flow: continue into `spec-and-tickets`.
