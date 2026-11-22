import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { describe, it } from "node:test";

import { buildPolicyDeps, contextRaisedPath, rememberContextRaised } from "../plugins/team-skills/hooks/policy-deps.mjs";

describe("buildPolicyDeps", () => {
  it("reads the allowlist, autonomous flag and trailer names from the given env", () => {
    const deps = buildPolicyDeps({
      cwd: process.cwd(),
      env: { TEAM_SELF_MERGE_ALLOWLIST: "alice,bob", TEAM_AUTONOMOUS: "1", TEAM_AGENT_TRAILER_NAMES: "Codex" },
      sessionId: "s",
    });
    assert.deepEqual(deps.allowlist, ["alice", "bob"]);
    assert.equal(deps.autonomous, true);
    assert.deepEqual(deps.agentTrailerNames, ["Codex"]);
  });

  it("defaults: not autonomous, default allowlist", () => {
    const deps = buildPolicyDeps({ cwd: process.cwd(), env: {}, sessionId: "s" });
    assert.equal(deps.autonomous, false);
    assert.deepEqual(deps.allowlist, ["parasbhatiwal"]);
  });

  it("supplies every resolver the policy module takes", () => {
    const deps = buildPolicyDeps({ cwd: process.cwd(), env: {}, sessionId: "s" });
    for (const key of ["getCurrentBranch", "getPrBase", "getMerger", "getPrAuthor", "getContextFreshness"]) {
      assert.equal(typeof deps[key], "function", key);
    }
  });

  it("remembers that stale context was raised, per session", () => {
    const sessionId = `test-${process.pid}-${Date.now()}`;
    try {
      assert.equal(buildPolicyDeps({ cwd: ".", env: {}, sessionId }).contextAlreadyRaised, false);
      rememberContextRaised({ sessionId, reason: "CLAUDE.md is stale" });
      assert.equal(buildPolicyDeps({ cwd: ".", env: {}, sessionId }).contextAlreadyRaised, true);
    } finally {
      rmSync(contextRaisedPath(sessionId), { force: true });
    }
    assert.equal(existsSync(contextRaisedPath(sessionId)), false);
  });

  it("does not remember for unrelated block reasons", () => {
    const sessionId = `test-other-${process.pid}-${Date.now()}`;
    rememberContextRaised({ sessionId, reason: "force push is blocked" });
    assert.equal(existsSync(contextRaisedPath(sessionId)), false);
  });
});
