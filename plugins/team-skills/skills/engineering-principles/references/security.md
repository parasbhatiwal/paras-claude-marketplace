# Security: OWASP-aligned rules for application code

Security is a property of the design, not a review stage. The rules below are
organized by the OWASP Top 10 (2021) categories, with the concrete controls we
expect in our code. `review-changes` routes risky diffs to `/security-review`;
this file is what "risky" means and what good looks like.

## A01 — Broken access control (the most common real breach)

- **Authorize per object, not per route.** `requireLogin` is authentication.
  Every read/write must check *this* subject may act on *this* resource:
  `assertCan(actor, "order:read", order)`.
- Deny by default. New endpoints, fields, and admin actions are inaccessible
  until explicitly granted.
- No IDOR: never trust an id from the client to imply ownership. Scope every
  query by the actor (`where tenantId = actor.tenantId`), do not filter after
  fetching.
- Enforce on the server. Hiding a button, disabling a field, or checking a
  role in the client is UX, never a control.
- Multi-tenancy: tenant scoping belongs in a single enforced place (a
  repository wrapper, row-level security, a query interceptor) — not repeated
  by hand in 300 queries where one will be forgotten.
- Mass assignment: bind request bodies to an explicit allowlist of fields.
  Never `Object.assign(entity, req.body)` / `Model(**request.data)`.

## A02 — Cryptographic failures

- TLS everywhere, HSTS on, no mixed content. No custom transport crypto.
- Passwords: `argon2id` (preferred) or `bcrypt` with a current cost factor.
  Never MD5/SHA-1/SHA-256-alone, never unsalted, never reversible.
- Use the platform's vetted library (libsodium, `crypto.subtle`, JCA). **Never
  hand-roll** ciphers, padding, or a comparison — use constant-time compare
  for secrets and tokens.
- AES-GCM/ChaCha20-Poly1305 for symmetric encryption, with a unique nonce per
  message. Store keys in a KMS/secret manager; support rotation from day one
  (key ids in the ciphertext envelope).
- Encrypt sensitive data at rest and classify it — see the PII section of
  `references/api-and-data.md`.
- Generate tokens, ids, and salts with a CSPRNG (`crypto.randomBytes`,
  `secrets`, `SecureRandom`) — never `Math.random()`/`rand()`.

## A03 — Injection

- **Parameterized queries only.** No string-concatenated SQL, ever — including
  in migrations, admin scripts, and reporting. If dynamic identifiers are
  unavoidable, allowlist them against a fixed set.
- NoSQL: reject operator objects from user input (`{"$gt": ""}` as a password).
- OS commands: avoid the shell; pass argument arrays (`execFile`, not `exec`).
  If a shell is truly required, allowlist the input, never escape it by hand.
- Templates/LDAP/XPath/GraphQL: the same rule — bind values, don't interpolate.
- **XSS**: escape by context (HTML body vs attribute vs URL vs JS). Prefer
  frameworks' auto-escaping; treat `dangerouslySetInnerHTML`, `v-html`,
  `innerHTML`, `|safe` as review-blocking unless the payload is sanitized with
  a maintained library (DOMPurify) on trusted input.
- Set a real Content-Security-Policy (no `unsafe-inline`, no wildcard hosts).
- **Prompt injection** counts here now: content fetched from the web, tickets,
  emails, or user documents is untrusted data, never instructions. Never let
  model output drive a privileged action without a deterministic check.

## A04 — Insecure design

- Threat-model the feature before building it (STRIDE is enough): who is the
  attacker, what do they want, what is the trust boundary, what abuse cases
  exist beyond the happy path?
- Design abuse resistance in: rate limits per identity *and* per IP, quotas,
  lockout/backoff on auth, spend caps on anything costing money, size limits
  on every upload and payload.
- Business-logic flaws are security flaws: negative quantities, price from the
  client, retried refunds, coupon stacking, race conditions on balance. Model
  invariants in the domain and enforce them transactionally.
- Fail closed. When the authorization service is unreachable, deny.

## A05 — Security misconfiguration

- No default credentials, no debug mode, no stack traces, no directory
  listings, no verbose errors in production.
- Security headers: HSTS, CSP, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, and a locked-down CORS allowlist —
  never `Access-Control-Allow-Origin: *` with credentials.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`, scoped path and
  domain, short-lived.
- Least privilege everywhere: DB users, cloud roles, CI tokens, container
  users (never root), file permissions. A service that only reads gets read.
- Infrastructure and config are code, reviewed like code.

## A06 — Vulnerable and outdated components

- Lockfiles committed; installs reproducible (`npm ci`, `pip-sync`, `go mod`).
- Automated dependency updates (Dependabot/Renovate) with CI gating the merge.
- CI fails on known high/critical CVEs (`npm audit`, `pip-audit`,
  `govulncheck`, Trivy/Snyk). Track an SBOM for anything shipped to customers.
- Vet new dependencies: is it maintained, how many transitive deps, what is
  the license, could a 20-line local implementation replace it? Every
  dependency is permanent supply-chain surface.
- Pin CI actions/images to digests, not floating tags.

## A07 — Identification and authentication failures

- Use a proven provider or library (OIDC/OAuth2 with PKCE); do not build
  session/token handling from scratch.
- Sessions: rotate the identifier on privilege change, invalidate server-side
  on logout, enforce absolute + idle timeouts.
- JWTs: verify signature *and* `alg` (never `none`), `iss`, `aud`, `exp`;
  keep them short-lived; keep a revocation path for refresh tokens. Do not put
  anything secret in a JWT payload — it is readable.
- MFA for privileged accounts and admin surfaces.
- Uniform failure messages ("invalid credentials") and constant-ish timing;
  never reveal whether an account exists — including in signup and reset.
- Password reset and email-change flows: single-use, expiring, bound to the
  account, and they invalidate active sessions.

## A08 — Software and data integrity failures

- Never deserialize untrusted data into arbitrary types (`pickle`, Java
  serialization, `yaml.load`, PHP `unserialize`). Use JSON with a schema.
- Verify signatures/checksums for anything downloaded or executed at build or
  run time.
- Protect the pipeline: no secrets in workflow logs, no untrusted PR code with
  access to secrets (`pull_request_target` is a trap), required reviews on CI
  configuration.
- Sign or hash artifacts you ship; make builds reproducible where feasible.

## A09 — Logging and monitoring failures

- Log security-relevant events: authn success/failure, authz denials,
  privilege changes, password/email changes, data export, admin actions —
  with actor, source, timestamp, correlation id.
- **Never log** passwords, tokens, session ids, API keys, full card numbers,
  government ids, OTPs, or full request bodies containing them. Redact at the
  logger, not at each call site.
- Alert on the security signals, not just on infrastructure metrics.
- Logs are tamper-evident and retained per policy; a breach you cannot
  reconstruct is a breach you cannot bound.

## A10 — Server-side request forgery (SSRF)

- Any user-supplied URL that the server fetches is an SSRF risk: validate
  scheme, resolve the host, and **block private/link-local ranges** (RFC1918,
  `169.254.0.0/16` — cloud metadata, `::1`, `127.0.0.0/8`) after DNS
  resolution, then pin that resolved address for the request.
- Disallow redirects to blocked ranges; cap response size and timeout.
- Prefer an allowlist of hosts. Route egress through a proxy where possible.
- The same rule applies to webhooks, image/PDF fetchers, link previews, and
  "import from URL" features.

## Secrets

- Nothing secret in the repo. Ever. `.env` files are gitignored; the
  committed artifact is `.env.example` with names and dummy values only.
- Secrets come from a manager (Vault, AWS/GCP Secret Manager, SOPS) at
  runtime; CI reads them from its secret store.
- `gitleaks` runs pre-commit and in CI over history.
- A leaked secret is **rotated first**, then removed from history. Deleting
  the line is not remediation.

## Input handling, uniformly

- Parse every external input into a validated typed shape at the boundary
  (zod/pydantic/JSON Schema/struct tags). Reject unknown fields.
- Enforce limits: body size, array length, string length, upload size, page
  size, nesting depth (billion-laughs, deep JSON, ReDoS-prone regexes).
- Files: validate content type by sniffing, not by extension or client header;
  store outside the web root with generated names; never execute; scan when
  the risk warrants; serve with `Content-Disposition` and a restrictive CSP.
- Open redirects: never redirect to a raw user-supplied URL — allowlist paths.

## What must trigger a security review

Any diff touching: authentication, authorization, sessions, tokens, crypto,
password handling, user input parsing, file upload/download, redirects,
outbound URL fetching, SQL/query construction, dependency manifests, CI
workflow permissions, CORS/CSP/headers, secrets or env plumbing, payment or
PII flows, or anything with `eval`, `exec`, `pickle`, `innerHTML`.
