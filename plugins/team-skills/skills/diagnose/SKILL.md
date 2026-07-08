---
name: diagnose
description: Use this skill when investigating a bug — before attempting any fix. Reproduces the bug as a failing automated test, then root-causes it. The failing test becomes the "red" that drives the fix via the implement skill.
---

# Diagnose

A bug is not understood until it is reproduced by a failing test. Diagnosis
produces two artifacts: a failing test and a root-cause statement. No fixes
happen in this skill.

## Process

1. **Restate the bug**: expected behavior vs. actual behavior, and the exact
   conditions that trigger it. If the report is vague, ask the user for the
   trigger conditions before guessing.
2. **Locate the suspect code path.** Trace from the symptom (error message,
   wrong output, UI state) back through the code. Read the code — do not
   theorize past what the source actually says.
3. **Write a failing test that reproduces the bug.**
   - Put it where the project's conventions dictate (next to existing tests
     for that module).
   - Run it and confirm it fails *because of the bug* — the assertion must
     express the CORRECT behavior and fail against current code.
   - If the bug cannot be captured in a unit test (e.g. environment-specific),
     capture the closest automatable reproduction and say explicitly what part
     remains manual.
4. **Root-cause it.** State: the defective line(s) (`file:line`), why the code
   is wrong, when/how it was introduced if git history shows it
   (`git log -S` / `git blame`), and the blast radius (what else calls this).
5. **Check for siblings.** The same mistake often exists elsewhere — search
   for the pattern before declaring the diagnosis complete.

## Output

```
Bug: <one line>
Repro test: <file> — currently RED
Root cause: <file:line> — <why>
Blast radius: <other affected callers/flows, or "isolated">
Siblings: <other occurrences found, or "none">
```

Hand off to `implement`: the repro test is the red of its first cycle; the fix
is whatever minimal change turns it green without breaking the suite.

## Rules

- Read-only for production code — the only files this skill creates are tests.
- Never mark diagnosis complete while the repro test is missing or passing.
