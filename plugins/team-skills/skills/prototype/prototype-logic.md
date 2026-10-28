# Logic prototype

A single self-contained HTML file (a shareable demo) that lets anyone drive a
state model by clicking buttons. Use when the question is about business
logic, state transitions or data shape — things that look reasonable on paper
and feel wrong only when pushed through. It speaks the domain's language, not
the code's, so a PM or domain expert can use it.

## Process

1. **State the question** in a visible intro (not just a comment), so a wrong
   question can be spotted.
2. **Isolate the logic in a portable module**: a pure reducer `(state, action)
   => state`, a state machine (when "which actions are legal now" is part of
   the question), a set of pure functions, or a class with a clear surface.
   Pick the shape that fits the question, not the one easiest to wire to a
   page. No DOM inside it; the page calls in, nothing flows back. This module
   survives past the prototype.
3. **Build one file** — plain HTML/CSS/JS, no framework, no server, all
   inline. Top to bottom: title + the question; **current state** as a
   readable labelled panel re-rendered after every click (call out what just
   changed); **free-play buttons**, one per action, always available;
   **guided walkthroughs** as tabs, each a scenario description plus the
   ordered buttons to press — choose the awkward cases: happy path, a tricky
   edge, an attempt at something that should be illegal. Restrained design.
4. **Hand it over.** The moments that matter are "wait, that shouldn't be
   possible" and "I assumed X would differ" — bugs in the *idea*.
5. **Capture**: lift the validated module into the real code; keep the HTML
   shell on the `prototype/<name>` branch.

## Anti-patterns

Framework or build step; raw JSON dumps as "state"; code-speak labels;
polish; persistence; logic tangled with the DOM.
