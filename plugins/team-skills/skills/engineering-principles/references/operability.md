# Operability: config, observability, resilience, rollout

Code that cannot be operated is not finished. Everything here is part of
"done", not a follow-up ticket.

## Configuration (12-factor)

- Config comes from the environment. No environment `if`s in business logic
  (`if (env === "prod")` is a design smell — inject the differing behavior).
- **Validate the whole config at startup** against a schema and fail fast with
  a message naming every missing/invalid variable. A service that boots and
  then dies on first request at 3am is an operability defect.
- Config is typed and read once into a frozen object; no `process.env` reads
  scattered through the codebase.
- Ship `.env.example` listing every variable with a description and a safe
  default. Secrets never have real defaults.
- Distinguish config (per-environment) from constants (per-code) from feature
  flags (per-rollout). Do not smuggle one as another.

## Structured logging

- JSON logs to stdout, one event per line. The platform handles shipping.
- Levels mean something: `error` = a human must look; `warn` = degraded but
  handled; `info` = business-significant events; `debug` = off in production.
  If everything is `error`, nothing is.
- Every log line carries: timestamp, level, message, `correlation_id`/
  `trace_id`, `actor_id` (never PII), `operation`, and outcome.
- Correlation id enters at the edge (header or generated), flows through every
  layer and every outbound call, and appears in the user-visible error
  reference. Use context propagation (AsyncLocalStorage, contextvars, ctx) —
  not a parameter threaded by hand.
- Redact at the logger with a field allowlist/denylist so a new call site
  cannot leak a token.
- No logging inside tight loops, no logging the same failure at three layers.

## Metrics and tracing

- **RED** for every service surface: Rate, Errors, Duration (as histograms —
  p50/p95/p99, never averages alone).
- **USE** for every resource: Utilization, Saturation, Errors (pool sizes,
  queue depth, memory, connections).
- Business metrics matter as much as technical ones: orders placed, signups,
  payment failures. They detect outages that stay green on CPU.
- OpenTelemetry for traces; instrument at boundaries (inbound handler,
  outbound client, DB call, queue publish/consume) and propagate context.
- Cardinality discipline: never label a metric with a user id, email, or URL
  containing ids.
- Health endpoints: `/livez` (am I running) and `/readyz` (can I serve — deps
  checked, cheaply and with a timeout). Never gate liveness on a dependency;
  that turns a downstream blip into a restart storm.

## Resilience

- **Every** outbound call has a timeout. A missing timeout is the single most
  common cause of cascading failure. Set connect and read timeouts explicitly;
  never rely on a library default.
- Retry only idempotent operations, with exponential backoff **and jitter**,
  a bounded attempt count, and a budget. Retrying a non-idempotent write is
  how you double-charge a customer.
- Circuit breakers on dependencies that can fail slowly; shed load rather than
  queueing unboundedly.
- Bulkheads: separate connection/thread pools per dependency so one slow
  downstream cannot starve the rest.
- Define degraded modes explicitly: what still works when the cache, the
  search index, or the recommendation service is down?
- Idempotency keys on every externally triggered write (payments, webhooks,
  imports). Consumers must be idempotent — at-least-once delivery is the norm.
- Backpressure over unbounded buffers: bounded queues, rejection with a clear
  error, and a dead-letter queue with a documented replay procedure.
- Graceful shutdown: stop accepting, drain in-flight with a deadline, close
  pools, flush telemetry. Handle SIGTERM.

## Data and schema changes

- Migrations are versioned, forward-only in production, reviewed like code,
  and **backward compatible** with the currently deployed application: expand
  → migrate → contract, across separate deploys. Never in one release: rename
  a column and deploy the code that reads it.
- Every migration is tested against a realistic dataset and has a documented
  rollback (or is provably safe to leave in place).
- Long-running backfills run as resumable, rate-limited, observable jobs — not
  inside a migration and not in a request handler.

## Rollout and change safety

- Small, frequent, reversible deployments. A large release is a large blast
  radius.
- Feature flags for anything user-visible or risky. Every flag has an owner,
  a default, and a removal ticket — flags are debt with a purpose, not
  permanent branches.
- Prefer progressive delivery: canary or percentage rollout with automatic
  rollback on error-rate/latency regression.
- Know the rollback procedure before deploying. If a change cannot be rolled
  back (data migration, external side effect), say so explicitly in the PR.

## Jobs, schedules, and queues

- Background jobs are idempotent, retryable, and observable, with a visible
  failure path (DLQ + alert), not fire-and-forget.
- Scheduled work is guarded against overlap and clock skew, and is safe when
  it runs twice or is skipped once.
- Never do slow work in a request handler; hand it to a queue and return a
  status the client can poll or subscribe to.

## Runbooks and ownership

- Every service has an owner, an on-call route, an SLO, and a runbook covering
  the top alerts: what it means, how to confirm, how to mitigate, how to
  escalate.
- Alerts are symptom-based (SLO burn, user-visible errors), actionable, and
  rare. An alert nobody acts on gets deleted or fixed — alert fatigue is an
  outage waiting to happen.
- Post-incident: blameless write-up with a timeline, contributing causes, and
  concrete follow-up items that are actually ticketed.
