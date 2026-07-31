# Quality attributes: performance, accessibility, i18n, maintainability

Cross-cutting properties that are cheap to design in and expensive to retrofit.

## Performance

- **Budget before optimizing.** State the target for the path in question
  (e.g. API p95 < 300 ms, LCP < 2.5 s, INP < 200 ms, CLS < 0.1, job throughput
  N/min). Without a budget, "fast enough" is an argument, not a criterion.
- Measure, never guess. Profile before changing anything; keep the before/after
  numbers in the PR. Most "obvious" optimizations target code that is not the
  bottleneck — and every one of them costs clarity.
- The usual real culprits, in order: N+1 queries, missing indexes, unbounded
  result sets, chatty network calls, missing pagination, oversized payloads and
  images, blocking work in a request handler, no caching where the data is
  static.
- Complexity matters at scale: an O(n²) loop over a list that is 10 today and
  100 000 next year is a latent outage. Bound every collection you iterate.
- Streaming over buffering for large payloads; never read a whole file or
  result set into memory when you can process it incrementally.
- Frontend: ship less JavaScript, code-split by route, defer non-critical work,
  lazy-load below the fold, set explicit image dimensions and modern formats,
  preconnect to critical origins. Track bundle size in CI with a budget that
  fails the build.
- Regression protection: performance tests on the critical path, and a query
  count assertion on hot endpoints. Performance without a gate erodes silently.

## Accessibility (WCAG 2.2 AA as the baseline)

- Semantic HTML first. A `<button>` is a button; a `<div>` with `onClick` is
  not — it loses focus, keyboard activation, and assistive-technology
  semantics. Reach for ARIA only when no native element fits, and prefer no
  ARIA to wrong ARIA.
- Every interactive element is reachable and operable by keyboard alone, in a
  logical order, with a visible focus indicator. Focus is managed on route
  change, modal open/close, and dynamic content insertion; traps are
  deliberate and escapable.
- Every input has a programmatically associated label; errors are announced
  and tied to their field (`aria-describedby`), never conveyed by color alone.
- Contrast ≥ 4.5:1 for body text, 3:1 for large text and UI boundaries. Target
  sizes ≥ 24×24 CSS px.
- Images carry meaningful `alt` (or `alt=""` when decorative); media has
  captions; icon-only controls have accessible names.
- Respect user preferences: `prefers-reduced-motion`, `prefers-color-scheme`,
  zoom to 200% without loss of content, and text resizing without clipping.
- Dynamic updates use live regions where appropriate; do not steal focus.
- Automated checks (axe) catch roughly a third of issues — keyboard-only and
  screen-reader passes stay on the PR's human-verification checklist.

## Internationalization

- No user-facing string literals in code. Externalize from day one; retrofitting
  i18n is a whole-codebase change.
- Never concatenate translated fragments — use full sentences with named
  placeholders, and use ICU plural/gender rules rather than `if (n === 1)`.
- Format dates, numbers, currencies, and names with the platform's locale APIs
  (`Intl`), not hand-rolled patterns. Store UTC, render local.
- Design for text expansion (~30–40% for German/Finnish) and for RTL: use
  logical CSS properties (`margin-inline-start`) so mirroring is free.
- Never assume name/address/phone/postcode structure, or that a person has a
  first and last name in that order.
- Unicode-correct string handling: normalize (NFC) before comparison, be aware
  of grapheme clusters when truncating, use locale-aware collation for sorting.

## Maintainability

- Optimize for the reader. Code is read far more often than written; the
  audience is a tired teammate at 2am — and increasingly a model with a
  limited window, which is what `project-context` and CLAUDE.md serve.
- Consistency beats personal preference. Formatting and lint rules are
  automated (Prettier/Black/gofmt + a strict linter) so style is never a
  review topic; the CI check is the arbiter.
- Strict typing on: no implicit `any`, `strict: true`, mypy/pyright strict,
  exhaustiveness checks on unions. Types are the cheapest tests you will ever
  write.
- Delete aggressively. Dead code, unused flags, stale docs, and abandoned
  experiments all cost reading time and mislead; git remembers them for you.
- Keep the dependency count justifiable and the upgrade path short — an
  un-upgradable dependency becomes a rewrite.
- Documentation lives with the code and is verified by CI where possible
  (runnable examples, generated API docs, tested snippets). Undated,
  unowned wiki pages are worse than nothing.
- Every non-obvious decision is an ADR (`references/design.md`). Institutional
  memory that only lives in someone's head leaves when they do.
