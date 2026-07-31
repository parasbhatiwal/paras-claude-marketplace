# APIs and data: contracts, schemas, migrations, privacy

## Contracts first

- Design the contract (OpenAPI/GraphQL SDL/protobuf/typed events) before the
  implementation; generate types from it so drift is impossible.
- The contract is the boundary of a bounded context. Never expose internal
  entities directly — map domain objects to explicit DTOs. Leaking your ORM
  model into JSON couples every consumer to your schema forever.
- Validate requests **and** responses against the schema in tests; a contract
  the server violates is worse than none.

## REST/HTTP conventions

- Resources are nouns; verbs live in the method. Use status codes honestly:
  `200/201/204`, `400` validation, `401` unauthenticated, `403` unauthorized,
  `404` absent (or hidden), `409` conflict, `422` semantic, `429` rate limit,
  `5xx` our fault. Never return `200` with `{"error": ...}`.
- One error envelope across the API, e.g.:
  ```json
  { "error": { "code": "order_not_found", "message": "…",
               "details": [], "correlation_id": "…" } }
  ```
  `code` is stable and machine-readable; `message` is human-readable and safe
  to show; details never leak internals or stack traces.
- Idempotency: `PUT`/`DELETE` are idempotent by definition; make `POST`
  idempotent for money-touching operations via an `Idempotency-Key` header
  with stored results.
- **Cursor-based pagination** with a bounded, documented default and maximum
  page size. Offset pagination breaks under concurrent writes and degrades on
  deep pages.
- Filtering/sorting fields come from an allowlist — never pass user strings
  into a query builder.
- Long operations return `202` plus a status resource; do not hold a
  connection open.
- Rate limits are documented and communicated (`Retry-After`, limit headers).

## Versioning and compatibility

- Additive changes only within a version: new optional fields, new endpoints.
  Removing/renaming a field, tightening validation, or changing a type is
  breaking — even when "nobody uses it".
- Version explicitly (`/v2`, media type, or a header) and run versions in
  parallel with a published deprecation window and a migration guide.
- Consumers ignore unknown fields; producers never rely on field order.
- Event schemas follow the same rules and carry a `schema_version`. Events are
  facts in the past tense (`OrderPlaced`), immutable once published.

## Database and persistence

- The schema is the last line of integrity defense: NOT NULL, foreign keys,
  unique constraints, and CHECK constraints for domain invariants. Do not rely
  on application code alone — concurrent writers and scripts bypass it.
- Choose keys deliberately: UUIDv7/ULID for distributed generation with
  index locality; never expose sequential ids that leak volume when that
  matters.
- Money is integer minor units or `DECIMAL` — never a float. Timestamps are
  stored in UTC with timezone awareness; render in local time at the edge.
- Transactions wrap a **use case**, not a repository call. Keep them short;
  never do network I/O inside one. Know your isolation level, and use explicit
  locking (`SELECT … FOR UPDATE`) or optimistic versioning for read-modify-write
  races — the classic double-spend/oversell bug.
- Index what you filter, join, and sort on; verify with `EXPLAIN` against
  realistic volumes, not an empty dev database.
- Kill N+1 queries at the source (batch/`IN`/join/dataloader) and add a test
  asserting the query count for hot paths.
- Deletes: prefer soft delete + retention job when audit matters; be explicit
  about cascade behavior — an accidental `ON DELETE CASCADE` is a data-loss
  incident.
- Outbox pattern for "write a row and publish an event" — dual writes without
  it lose events on failure.

## Caching

- Every cache entry has an explicit TTL and a documented invalidation trigger.
  A cache without an invalidation story is a correctness bug with latency
  benefits.
- Never cache authorization decisions or per-user data under a shared key —
  cache poisoning across tenants is a breach, not a bug.
- Handle stampedes (single-flight/locking) and treat the cache as optional:
  the system must be correct, if slower, with the cache empty or down.

## Data privacy and classification

- Classify data explicitly: public / internal / confidential / regulated
  (PII, PHI, PCI). The classification drives encryption, logging, retention,
  and access rules.
- Collect the minimum. Every stored personal field needs a purpose; if there
  is no purpose, do not store it.
- Retention and deletion are features: implement export and erasure paths
  (GDPR/CCPA subject requests) rather than promising them manually. Remember
  backups, logs, analytics, and third-party processors.
- Pseudonymize in analytics and non-production. **Never copy production
  personal data into staging or a developer machine** — generate or mask it.
- Keep an inventory of third parties receiving personal data, and check the
  contract before adding a new one.
- Consent and audit trails are data too: who accessed what, when, and why —
  for regulated data, that log is mandatory.
