---
name: wizard
description: Use this skill when the next step is one only a human can take - provisioning infrastructure, setting CI secrets, clicking through an unfamiliar third-party dashboard, a one-off migration or cutover. Generates an interactive bash wizard that walks the human through it. Not for steps the agent can do itself.
---

# Wizard

Adapted from Matt Pocock's `wizard` skill (MIT; see
`THIRD_PARTY_NOTICES.md`); `template.sh` is copied from it.

A **wizard** is a bash script that walks a human through a manual procedure
that is tedious to do by hand and tedious to re-explain to an AI: it opens
each URL, says what to click and copy, captures values, writes them where they
belong (`.env`, GitHub secrets), confirms at every stage, and shows stages
left. `template.sh` (next to this file) already solves the UX; **your job is
to scope the procedure and author its stages.** The library above the
`STAGES` marker is identical in every wizard — never hand-edit it.

In the v2 workflow, a wizard is the right artifact for the `ready-for-human`
setup ticket the `handoff-gate` raises when the cloud runner lacks access.
It is also how credentials get set without an agent ever handling the values
(names are documented, values are typed by the human).

Ephemeral by default: built for one run, saved to scratch or `scripts/`,
deleted afterward. Commit only when it is a repeatable setup path.

## Process

1. **Scope the procedure.** Read first, don't ask cold: `.env.example`,
   `README`, `docker-compose*`, framework config, and `.github/workflows/*`
   (every `secrets.*` / `vars.*` reference is a value to produce). For a
   migration: current state, target state, irreversible actions between.
   Show the ordered stages and the values each produces; the user may edit.
   *Done when* each captured value has: where the human gets it, where it is
   written (`.env`, a GitHub secret, both, nowhere), and secret vs public.
2. **Map each stage's journey** precisely — URL, what to do, where the value
   appears, which variable it fills. Where you do not know the current UI or
   exact command, say so and check docs or ask. Never invent steps.
3. **Author it.** Copy `template.sh` to the target path; replace the example
   stage with one `stage` per step in dependency order, using the library
   helpers (`stage`, `say`/`step`, `open_url`, `ask`/`ask_secret`,
   `write_env`, `set_secret`/`set_var`, `pause`/`confirm`). Open the URL
   before asking for its value; `ask_secret` for anything secret; `confirm`
   before irreversible actions; one focused task per stage. Set
   `TOTAL_STAGES`.
4. **Verify statically.** `bash -n`, `shellcheck` if available, `chmod +x`.
   Do not run it end to end (it opens browsers and blocks on input); trace
   that every captured value lands where step 1 said and every `set_secret`
   name matches a `secrets.*` reference in CI. Tell the user how to run it.
