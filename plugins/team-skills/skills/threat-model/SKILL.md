---
name: threat-model
description: Use this skill before building anything security-sensitive - auth, payments, file handling, multi-tenancy, PII, admin surfaces, public APIs, integrations ("threat model this", "is this design safe", "what could go wrong here"). Runs a STRIDE pass over the design, produces ranked threats with concrete mitigations, and turns each mitigation into a testable requirement.
---

# Threat Model

Security defects are design defects found late. This skill finds them early,
before there is code to defend. Run it during `brainstorm`, not after
`implement`.

Depth on individual controls lives in the security reference of the
`engineering-principles` skill; this skill is the *process* that decides which
controls this feature needs.

## When to run it

Any feature touching: authentication, authorization, sessions, tokens,
payments, PII/PHI, file upload or download, outbound URL fetching, webhooks,
multi-tenancy, admin or support tooling, a public API, a new third-party
integration, or anything that executes or deserializes external input.

If unsure, run it — it takes minutes and it is far cheaper than the incident.

## Stage 1 — Describe the system

1. **Assets**: what is worth attacking here? (customer data, money, credits,
   reputation, availability, the model's outputs, admin capability)
2. **Actors**: anonymous user, authenticated user, other tenant, support
   agent, admin, a compromised dependency, a compromised internal service.
   Include the *insider* and the *former* employee.
3. **Data flow**: entry points → processing → storage → outbound calls. A
   five-line sketch is enough; name every hop.
4. **Trust boundaries**: draw where data crosses from less-trusted to
   more-trusted. Every crossing is where validation and authorization belong.

## Stage 2 — STRIDE per boundary

For each trust boundary, ask each question. Record only the plausible ones.

| | Threat | Ask |
|---|---|---|
| **S** | Spoofing | Can someone claim to be another user, tenant, or service? Are tokens verified, bound, and short-lived? |
| **T** | Tampering | Can a request, payload, price, id, or stored record be altered in transit or at rest? Is integrity checked? |
| **R** | Repudiation | Can a damaging action happen without an audit trail naming the actor? |
| **I** | Information disclosure | What leaks via responses, errors, logs, timing, filenames, ids, or cache keys? Cross-tenant? |
| **D** | Denial of service | What is unbounded — payload size, result set, retries, uploads, expensive queries, spend? |
| **E** | Elevation of privilege | Can a user reach an admin path, another tenant's object, or a more privileged token? Is authz per object? |

Then add the checks STRIDE misses:

- **Business-logic abuse**: negative amounts, replayed refunds, coupon
  stacking, race conditions on balance or stock, out-of-order webhooks.
- **Prompt/content injection**: is any fetched or user-supplied content
  reaching a model or a template as if it were instructions?
- **Supply chain**: what new dependency does this add, and what would a
  compromise of it reach?

## Stage 3 — Rank and mitigate

For each threat: **likelihood × impact** → critical / high / medium / low.

Every threat gets one of four dispositions, explicitly:

- **Mitigate** — a specific control, named (not "validate input" but "parse
  the body with a schema that rejects unknown fields, cap array length at 100")
- **Transfer** — the provider handles it (say which, and what remains ours)
- **Accept** — with a stated reason and an owner
- **Eliminate** — remove the feature or the data that creates the risk. Often
  the best answer: data you never store cannot leak.

Anything ranked critical or high must be mitigated or eliminated. "Accept" is
not available for those without an explicit, recorded decision by the user.

## Stage 4 — Turn mitigations into tests

A mitigation without a test is a hope. Each becomes a requirement in the
`brainstorm` chunk list, phrased so `implement` can write the failing test
first:

```
- Threat: another tenant reads an order by guessing its id (E, high)
  Mitigation: repository scopes every query by actor.tenantId
  Test: request an order belonging to tenant B as tenant A → 404, not 403
```

Always include the **negative** tests — denied, rejected, rate-limited,
truncated. The allowed path proves nothing about the control.

## Output

```
Feature: <name>
Assets: <list>
Trust boundaries: <list>

| # | Threat (STRIDE) | Likelihood×Impact | Disposition | Control | Test |
|---|---|---|---|---|---|

Residual risks accepted: <with owner and reason, or "none">
```

Hand the control/test column to `brainstorm` so they become chunks, and note
in the PR body that a threat model was done.

## Rules

- Model the design, not the code you hope to write. If the design cannot be
  made safe, change the design — that is the point of doing this first.
- Assume the attacker has your source, your API docs, and a valid low-privilege
  account. Obscurity is not a control.
- Do not hand-roll crypto, session handling, or access-control primitives as a
  "mitigation" — use the platform's.
- Keep it proportionate: a fifteen-minute pass on a small feature is worth far
  more than a document nobody finishes.
- Re-run it when the feature's trust boundaries change — new integration, new
  actor, new data class.
