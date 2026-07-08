# Testing bootstrap (Vitest + React Testing Library)

Team policy: **every project must have a test runner and unit tests.** The
commit/push gates block projects without one. This is the standard bootstrap
for our Next.js/React projects; adapt for other stacks (pytest, go test, …).

## Install

```sh
npm i -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

## `vitest.config.mts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react"; // npm i -D @vitejs/plugin-react

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "cobertura"], // json-summary + cobertura are REQUIRED by CI
      include: ["src/**", "app/**", "components/**", "lib/**"],
    },
  },
});
```

## `vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

## `package.json` scripts (required names — CI and hooks call these)

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## Conventions

- Test files live next to the code: `lib/foo.ts` → `lib/foo.test.ts`.
- Component tests use Testing Library; assert on behavior/accessible roles,
  not implementation details or snapshots.
- Mock only true externals (network, clock); never the unit under test.
- First test to write in a fresh project: the most important pure function in
  `lib/` — cheap, fast, and proves the pipeline end to end.

## Sanity check

`npm test` → runs and reports; `npm run test:coverage` → produces
`coverage/coverage-summary.json` and `coverage/cobertura-coverage.xml`.
Both must exist for the CI diff-coverage and ratchet gates.
