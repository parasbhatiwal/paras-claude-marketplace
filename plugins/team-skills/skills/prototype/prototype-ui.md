# UI prototype

Several **radically different** UI variations on a single route, switchable
from a floating bottom bar. The user flips between them, picks one (or steals
bits), and the rest are thrown away.

## Two sub-shapes — strongly prefer A

- **A. Adjustment to an existing page (default).** Variants render on the
  same route gated by `?variant=`; data fetching, params and auth stay; only
  rendering swaps. A variant butting up against the real header, sidebar, data
  and density is judged honestly; an isolated route is a vacuum where every
  variant looks fine. Something that would naturally live inside a page (a new
  section, card, or step) is still A — mount it in the host page.
- **B. A new page (last resort)**, only when nothing existing can host it.
  Throwaway route following the project's routing convention, named with
  `prototype`. Same `?variant=` pattern. First sanity-check that no existing
  page fits: an empty route hides design problems a populated one exposes.

## Process

1. **State the question and pick N** — default 3 variants, cap 5 (more stops
   being radically different). Write the plan in one line at the prototype's
   location.
2. **Generate radically different variants.** Differ in layout, hierarchy and
   interaction model, not colors. Each fits the page's purpose and real data.
3. **Floating bottom bar**: variant switcher driven by the URL param, so a
   variant is linkable.
4. **Run it and look** — start the app and check each variant renders with
   real data, at desktop and phone width.
5. **Capture** as in `prototype`: decision into real code, prototype kept on
   a `prototype/<name>` branch.
