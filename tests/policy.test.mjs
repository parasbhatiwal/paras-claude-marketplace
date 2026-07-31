import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateCommand, parseAllowlist } from "../plugins/team-skills/hooks/policy.mjs";

const TRAILERS =
  "Co-Authored-By: Paras <paras@example.com>\nCo-Authored-By: Claude <noreply@anthropic.com>";

const compliantCommit = `git commit -m "feat(x): add thing\n\n${TRAILERS}"`;

const evaluate = (cmd, deps) => evaluateCommand(cmd, deps);
const isBlocked = (cmd, deps) => evaluate(cmd, deps).action === "block";
const reason = (cmd, deps) => evaluate(cmd, deps).reason ?? "";

describe("non-git commands", () => {
  test("allows unrelated tooling", () => {
    assert.equal(isBlocked("npm run test"), false);
    assert.equal(isBlocked("rg 'git commit' docs/"), false);
  });

  test("allows an empty or missing command", () => {
    assert.equal(isBlocked(""), false);
    assert.equal(isBlocked(undefined), false);
  });
});

describe("--no-verify", () => {
  test("blocks --no-verify on commit and push", () => {
    assert.equal(isBlocked('git commit --no-verify -m "x"'), true);
    assert.equal(isBlocked("git push --no-verify"), true);
  });

  test("blocks the -n shorthand next to commit/push", () => {
    assert.equal(isBlocked('git commit -n -m "x"'), true);
  });

  test("does not misread -n on other subcommands", () => {
    assert.equal(isBlocked("git log -n 5"), false);
    assert.equal(isBlocked("git shortlog -n"), false);
  });

  test("does not leak across command separators", () => {
    // `-n` belongs to `git log`, not to the push before it
    assert.equal(isBlocked("git push origin main && git log -n 5"), false);
    assert.equal(isBlocked("git push origin main | head -n 5"), false);
  });

  test("does not leak across newlines in a multi-line command", () => {
    assert.equal(isBlocked("git push origin feat/x\ngit log -n 5"), false);
  });
});

describe("force push", () => {
  test("blocks force push to protected branches", () => {
    assert.equal(isBlocked("git push --force origin main"), true);
    assert.equal(isBlocked("git push --force-with-lease origin master"), true);
    assert.equal(isBlocked("git push -f origin main"), true);
  });

  test("allows force push to a feature branch", () => {
    assert.equal(isBlocked("git push --force-with-lease origin feat/thing"), false);
  });
});

describe("history rewrites", () => {
  test("blocks rewrites targeting main/master", () => {
    assert.equal(isBlocked("git rebase main"), true);
    assert.equal(isBlocked("git reset --hard origin/main"), true);
    assert.equal(isBlocked("git push origin --delete main"), true);
  });

  test("allows rewrites on a feature branch", () => {
    assert.equal(isBlocked("git rebase feat/other"), false);
    assert.equal(isBlocked("git reset --hard HEAD~1"), false);
  });
});

describe("commit trailers", () => {
  test("allows a commit carrying both trailers", () => {
    assert.equal(isBlocked(compliantCommit), false);
  });

  test("blocks a commit with no trailers", () => {
    assert.equal(isBlocked('git commit -m "feat(x): add thing"'), true);
    assert.match(reason('git commit -m "feat(x): add thing"'), /BOTH trailers/);
  });

  test("blocks a commit missing the human trailer", () => {
    const cmd = 'git commit -m "fix: y\n\nCo-Authored-By: Claude <noreply@anthropic.com>"';
    assert.equal(isBlocked(cmd), true);
  });

  test("blocks a commit missing the Claude trailer", () => {
    const cmd = 'git commit -m "fix: y\n\nCo-Authored-By: Paras <paras@example.com>"';
    assert.equal(isBlocked(cmd), true);
  });

  test("accepts a versioned Claude identity", () => {
    const cmd =
      'git commit -m "fix: y\n\nCo-Authored-By: Paras <p@example.com>\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>"';
    assert.equal(isBlocked(cmd), false);
  });

  test("treats a human literally named Claude as a human trailer", () => {
    const cmd =
      'git commit -m "fix: y\n\nCo-Authored-By: Claude Dupont <claude.dupont@example.com>\nCo-Authored-By: Claude <noreply@anthropic.com>"';
    assert.equal(isBlocked(cmd), false);
  });

  test("splits trailers written with escaped newlines", () => {
    // A single-line command where \n is literal text, not a newline: the two
    // trailers must still be read as two separate lines.
    const cmd =
      'git commit -m "fix: y\\n\\nCo-Authored-By: Paras <p@example.com>\\nCo-Authored-By: Claude <noreply@anthropic.com>"';
    assert.equal(isBlocked(cmd), false);
  });

  test("checks the commit in a compound command", () => {
    assert.equal(isBlocked('git add -A && git commit -m "chore: x"'), true);
    assert.equal(isBlocked(`git add -A && ${compliantCommit}`), false);
  });

  test("defers -F/--amend messages to the commit-msg git hook", () => {
    assert.equal(isBlocked("git commit -F /tmp/msg.txt"), false);
    assert.equal(isBlocked("git commit --amend --no-edit"), false);
  });
});

describe("gh pr merge self-merge policy", () => {
  const deps = (merger, author, allowlist = ["owner"]) => ({
    getMerger: () => merger,
    getPrAuthor: () => author,
    allowlist,
  });

  test("allows merging someone else's PR", () => {
    assert.equal(isBlocked("gh pr merge 12 --squash", deps("reviewer", "author")), false);
  });

  test("blocks a non-allowlisted user self-merging", () => {
    const v = evaluate("gh pr merge 12 --squash", deps("author", "author"));
    assert.equal(v.action, "block");
    assert.match(v.reason, /self-merge not allowed/);
  });

  test("allows an allowlisted owner self-merging", () => {
    assert.equal(isBlocked("gh pr merge --squash", deps("owner", "owner")), false);
  });

  test("blocks when identity cannot be verified", () => {
    const v = evaluate("gh pr merge 12", deps(null, null));
    assert.equal(v.action, "block");
    assert.match(v.reason, /cannot verify/);
  });

  test("still checks git writes chained after an allowed merge", () => {
    const cmd = "gh pr merge 12 --squash && git push --force origin main";
    assert.equal(isBlocked(cmd, deps("reviewer", "author")), true);
    assert.match(reason(cmd, deps("reviewer", "author")), /force-pushing/);
  });

  test("passes the PR reference through to the author lookup", () => {
    let seen = "unset";
    evaluate("gh pr merge 42 --squash", {
      getMerger: () => "reviewer",
      getPrAuthor: (ref) => {
        seen = ref;
        return "author";
      },
    });
    assert.equal(seen, "42");
  });
});

describe("parseAllowlist", () => {
  test("splits, trims, and drops empties", () => {
    assert.deepEqual(parseAllowlist(" alice , bob ,, "), ["alice", "bob"]);
    assert.deepEqual(parseAllowlist(""), []);
    assert.deepEqual(parseAllowlist(undefined), []);
  });
});
