---
name: diagnose
description: Use this skill when investigating any bug, flake or performance regression - before attempting a fix. Builds a tight red-capable feedback loop first, reproduces and minimizes, tests ranked falsifiable hypotheses, root-causes with siblings and blast radius, and leaves a failing regression test. The red drives the fix via the implement skill.
---

# Diagnose

Adapted in part from Matt Pocock's bug-diagnosis skill (MIT; see
`THIRD_PARTY_NOTICES.md`), merged with the team's root-cause and
siblings discipline.

A bug is not understood until a **tight loop goes red on it**. Diagnosis
produces: a red-capable loop, a minimal failing test, and a root-cause
statement. No fix happens here — the fix is `implement`'s first green.

Read `GLOSSARY.md` and ADRs for the area first.

## Redact

Everything you show — commands, outputs, captured artifacts — has secrets
replaced by `<REDACTED>`. Build loops against env vars so credentials stay in
the environment; quote only the lines that carry the signal. If redacted
output is not enough to diagnose, say so and ask.

## Phase 1 — Build a feedback loop (this is the skill)

With a tight pass/fail signal that goes red on *this* bug you will find the
cause; bisection, hypotheses and instrumentation merely consume it. Without
one, staring at code will not save you. Spend disproportionate effort here.
Be aggressive and creative.

Ways to build one, roughly in order: (1) failing test at whatever seam reaches
the bug; (2) curl/HTTP script against a running dev server; (3) CLI invocation
on a fixture, diffing against a known-good snapshot; (4) headless-browser
script asserting on DOM/console/network; (5) replay a captured trace/payload;
(6) throwaway harness of a minimal subset of the system; (7) property/fuzz loop
for "sometimes wrong"; (8) bisection harness for "worked between two states"
(`git bisect run`); (9) differential loop old-vs-new; (10) a structured
human-in-the-loop script, last resort.

**Tighten it**: faster (cache setup, narrow scope), sharper (assert the
specific symptom, not "didn't crash"), more deterministic (pin time, seed RNG,
isolate filesystem, freeze network). A 2-second deterministic loop is a
debugging superpower; a 30-second flaky one is barely better than none.

**Non-deterministic bugs:** the goal is a *higher reproduction rate*, not a
clean repro. Loop the trigger 100×, parallelize, add stress, narrow timing
windows. 50% is debuggable; 1% is not — keep raising it.

**Cannot build a loop?** Stop and say so, listing what you tried, and ask for:
access to an environment that reproduces it, a redacted captured artifact
(HAR, log dump, core dump), or permission to add temporary production
instrumentation. In an unattended run, label the issue `needs-info` with
exactly that. Never hypothesize without a loop.

**Phase 1 is done when** you can name **one command**, already run (show the
invocation and redacted output), that is: **red-capable** (drives the real
code path and asserts the user's exact symptom — not "runs without
erroring"), **deterministic**, **fast** (seconds), and **agent-runnable**.
Reading code to build a theory before this command exists is the exact failure
this skill prevents.

## Phase 2 — Reproduce and minimize

Run it; watch it go red. Confirm it shows the failure the **user** described
(wrong bug = wrong fix), reproduces across runs (or at a high enough rate),
and that the exact symptom is captured for later verification.

Then **minimize**: cut inputs, callers, config, data, steps one at a time,
re-running after each, until every remaining element is load-bearing
(removing any makes it go green). A minimal repro shrinks the hypothesis
space and becomes the clean regression test.

## Phase 3 — Hypothesize

Write **3–5 ranked, falsifiable hypotheses** before testing any: "If X is the
cause, then changing Y makes it vanish / changing Z makes it worse." A
hypothesis with no prediction is a vibe; sharpen or discard. Attended: show
the list before testing (the user often re-ranks it instantly); unattended:
proceed with your ranking.

## Phase 4 — Instrument

Each probe maps to one prediction; change one variable at a time. Prefer a
debugger/REPL (one breakpoint beats ten logs), then targeted logs at the
boundaries that distinguish hypotheses — never "log everything and grep".
**Tag every debug log** with a unique prefix (`[DEBUG-a4f2]`) so cleanup is a
single grep. Performance regressions: logs are usually wrong; baseline-measure
first (timing harness, profiler, query plan), then bisect.

## Phase 5 — Root cause, siblings, regression test

1. **Root cause**: the defective `file:line`, why it is wrong, when it was
   introduced (`git log -S` / `git blame`), and blast radius (what else calls
   it).
2. **Siblings**: the same mistake often exists elsewhere — search for the
   pattern before declaring done.
3. **Regression test at the correct seam.** A correct seam exercises the real
   bug pattern as it occurs at the call site; a too-shallow one (single-caller
   test when the bug needs several callers) gives false confidence. Turn the
   minimized repro into a failing test there; if you forced red by mutating
   code or a fixture, `diff` against a pristine copy to prove the mutation
   landed. **If no correct seam exists, that is itself the finding** — the
   architecture is preventing the bug from being locked down; flag it for
   `improve-architecture`.

## Output

```
Bug: <one line>
Loop: <the command> — red (<n/N> runs, <seconds>)
Repro test: <file> — currently RED
Root cause: <file:line> — <why>; introduced <commit/when>
Hypotheses tested: <the one that held, and what ruled out the others>
Blast radius: <affected callers/flows, or "isolated">
Siblings: <other occurrences found, or "none">
Seam: <where the regression test lives, or "none — see improve-architecture">
```

Hand off to `implement`: the repro test is the red of its first cycle.

## Cleanup (before declaring done)

- [ ] Original repro still goes red (the loop works)
- [ ] All `[DEBUG-…]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway harnesses deleted or moved somewhere clearly marked
- [ ] The hypothesis that held is written down for the commit/PR message, so
      the next debugger learns

## Rules

- Production code is read-only here; the only files created are tests and
  disposable harnesses.
- Never mark diagnosis complete while the repro test is missing or passing.
