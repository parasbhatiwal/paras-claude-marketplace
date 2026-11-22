/**
 * Unit tests for the Cursor and Codex hook adapters.
 *
 * FIXTURES ARE DOCUMENTATION-DERIVED. Every payload below is built by hand from
 * the field lists in plugins/team-skills/references/agent-tool-contracts.md.
 * None is a recorded real payload: nobody on the project can run Codex or
 * Cursor. Where the reference lists a field name as unconfirmed (Cursor `Write`
 * and Codex `apply_patch` internals), the tests pin the best-effort decision
 * made there: warn and allow.
 *
 * The real policy and quality modules run underneath; nothing is mocked.
 * Forbidden-flag fixtures are assembled from parts so the repo's own git guard
 * does not block the commit that adds them.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adaptPayload,
  allowResult,
  blockResult,
  failOpenResult,
  guardPayload,
} from "../plugins/team-skills/hooks/hook-adapters.mjs";

const NO_VERIFY = ["--no", "verify"].join("-");
const badPush = `git push ${NO_VERIFY} origin feat/x`;
const common = { conversation_id: "c1", model: "m", cursor_version: "x", workspace_roots: ["/w"] };
const codexCommon = { session_id: "s1", transcript_path: "/t", cwd: "/w", model: "m", turn_id: "t1", tool_use_id: "u1" };

const cursorShell = (command) => ({ ...common, hook_event_name: "beforeShellExecution", command, cwd: "/w", sandbox: false });
const cursorTool = (tool_name, tool_input) => ({ ...common, hook_event_name: "preToolUse", tool_name, tool_input, tool_use_id: "u", cwd: "/w" });
const codexTool = (tool_name, tool_input) => ({ ...codexCommon, hook_event_name: "PreToolUse", tool_name, tool_input });

// An empty deps object is a deliberately supplied (inert) policy context: the
// real policy rules still run, with no gh or git lookups.
const POLICY = { policy: {} };

const TS_ANY = "const a: " + "any" + " = 1;";

describe("result helpers", () => {
  it("allow is silent exit 0", () => {
    assert.deepEqual(allowResult(), { exitCode: 0, stderr: "" });
  });
  it("block is exit 2 with the reason on stderr", () => {
    const r = blockResult("nope");
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /BLOCKED: nope/);
  });
  it("fail open is exit 0 and says the guard is inactive and why", () => {
    const r = failOpenResult("bad json");
    assert.equal(r.exitCode, 0);
    assert.match(r.stderr, /inactive/i);
    assert.match(r.stderr, /bad json/);
  });
});

describe("adaptPayload: Cursor beforeShellExecution", () => {
  it("normalizes the command and cwd", () => {
    assert.deepEqual(adaptPayload("cursor", cursorShell("ls")), {
      kind: "shell", command: "ls", cwd: "/w", sessionId: "c1",
    });
  });
  it("accepts a JSON string", () => {
    assert.equal(adaptPayload("cursor", JSON.stringify(cursorShell("ls"))).kind, "shell");
  });
  it("is unrecognised when command is missing", () => {
    assert.equal(adaptPayload("cursor", { ...common, hook_event_name: "beforeShellExecution" }).kind, "unrecognised");
  });
});

describe("adaptPayload: Cursor preToolUse", () => {
  it("normalizes a Shell tool call", () => {
    const n = adaptPayload("cursor", cursorTool("Shell", { command: "ls" }));
    assert.equal(n.kind, "shell");
    assert.equal(n.command, "ls");
  });
  it("normalizes a Write tool call", () => {
    const n = adaptPayload("cursor", cursorTool("Write", { file_path: "a.ts", content: "x" }));
    assert.deepEqual(n.edits, [{ filePath: "a.ts", added: "x", removed: "" }]);
    assert.equal(n.kind, "edit");
  });
  it("is unrecognised when Write lacks the needed fields", () => {
    assert.equal(adaptPayload("cursor", cursorTool("Write", { something: 1 })).kind, "unrecognised");
  });
  it("ignores tools the guard does not cover", () => {
    assert.equal(adaptPayload("cursor", cursorTool("Read", { path: "a" })).kind, "ignore");
  });
});

describe("adaptPayload: Codex PreToolUse", () => {
  it("normalizes Bash", () => {
    const n = adaptPayload("codex", codexTool("Bash", { command: "ls" }));
    assert.deepEqual(n, { kind: "shell", command: "ls", cwd: "/w", sessionId: "s1" });
  });
  it("parses apply_patch into per-file added and removed text", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/new.ts",
      "+one",
      "+two",
      "*** Update File: src/old.ts",
      "@@",
      " keep",
      "-gone",
      "+fresh",
      "*** Delete File: src/dead.ts",
      "*** End Patch",
    ].join("\n");
    const n = adaptPayload("codex", codexTool("apply_patch", { command: patch }));
    assert.equal(n.kind, "edit");
    assert.deepEqual(n.edits, [
      { filePath: "src/new.ts", added: "one\ntwo", removed: "" },
      { filePath: "src/old.ts", added: "fresh", removed: "gone" },
      { filePath: "src/dead.ts", added: "", removed: "" },
    ]);
  });
  it("normalizes Edit and Write with file_path and content fields", () => {
    const w = adaptPayload("codex", codexTool("Write", { file_path: "a.ts", content: "x" }));
    assert.deepEqual(w.edits, [{ filePath: "a.ts", added: "x", removed: "" }]);
    const e = adaptPayload("codex", codexTool("Edit", { file_path: "a.ts", old_string: "o", new_string: "n" }));
    assert.deepEqual(e.edits, [{ filePath: "a.ts", added: "n", removed: "o" }]);
  });
  it("is unrecognised when apply_patch carries no patch text", () => {
    assert.equal(adaptPayload("codex", codexTool("apply_patch", {})).kind, "unrecognised");
  });
  it("ignores other tools", () => {
    assert.equal(adaptPayload("codex", codexTool("mcp__x__y", {})).kind, "ignore");
  });
});

describe("adaptPayload: bad input", () => {
  it("unparseable JSON is unrecognised with a reason", () => {
    const n = adaptPayload("cursor", "{not json");
    assert.equal(n.kind, "unrecognised");
    assert.match(n.reason, /JSON/);
  });
  it("unknown event is unrecognised", () => {
    assert.equal(adaptPayload("cursor", { hook_event_name: "afterAgentThought" }).kind, "unrecognised");
    assert.equal(adaptPayload("codex", { hook_event_name: "Stop" }).kind, "unrecognised");
  });
  it("unknown tool name for the adapter is unrecognised", () => {
    assert.equal(adaptPayload("vim", {}).kind, "unrecognised");
  });
  it("non-object JSON is unrecognised", () => {
    assert.equal(adaptPayload("codex", "42").kind, "unrecognised");
  });
});

describe("guardPayload end to end, through the real policy and quality modules", () => {
  const cases = [
    ["cursor beforeShellExecution", "cursor", (c) => cursorShell(c)],
    ["cursor preToolUse Shell", "cursor", (c) => cursorTool("Shell", { command: c })],
    ["codex PreToolUse Bash", "codex", (c) => codexTool("Bash", { command: c })],
  ];
  for (const [name, tool, build] of cases) {
    it(`${name}: allows an ordinary command`, () => {
      assert.deepEqual(guardPayload(tool, build("npm test"), POLICY), allowResult());
    });
    it(`${name}: blocks a policy violation with exit 2 and the reason`, () => {
      const r = guardPayload(tool, build(badPush), POLICY);
      assert.equal(r.exitCode, 2);
      assert.match(r.stderr, /BLOCKED/);
      assert.match(r.stderr, /verify/i);
    });
  }

  it("cursor Write: blocks a quality violation", () => {
    const r = guardPayload("cursor", cursorTool("Write", { file_path: "src/a.ts", content: TS_ANY }), POLICY);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /BLOCKED/);
  });
  it("cursor Write: allows clean content", () => {
    assert.deepEqual(
      guardPayload("cursor", cursorTool("Write", { file_path: "src/a.ts", content: "const a = 1;" }), POLICY),
      allowResult(),
    );
  });
  it("codex apply_patch: blocks a quality violation in added lines", () => {
    const patch = `*** Begin Patch\n*** Add File: src/a.ts\n+${TS_ANY}\n*** End Patch`;
    assert.equal(guardPayload("codex", codexTool("apply_patch", { command: patch }), POLICY).exitCode, 2);
  });
  it("codex apply_patch: allows a clean patch", () => {
    const patch = "*** Begin Patch\n*** Add File: src/a.ts\n+const a = 1;\n*** End Patch";
    assert.deepEqual(guardPayload("codex", codexTool("apply_patch", { command: patch }), POLICY), allowResult());
  });
  it("one dirty file in a multi-file patch blocks the whole patch", () => {
    const patch = `*** Begin Patch\n*** Add File: a.ts\n+const a = 1;\n*** Add File: b.ts\n+${TS_ANY}\n*** End Patch`;
    assert.equal(guardPayload("codex", codexTool("apply_patch", { command: patch }), POLICY).exitCode, 2);
  });

  it("unparseable payload fails open with a warning", () => {
    for (const tool of ["cursor", "codex"]) {
      const r = guardPayload(tool, "<<<garbage", POLICY);
      assert.equal(r.exitCode, 0);
      assert.match(r.stderr, /inactive/i);
    }
  });
  it("unknown event fails open with a warning naming the event", () => {
    const r = guardPayload("cursor", { hook_event_name: "afterAgentThought" }, POLICY);
    assert.equal(r.exitCode, 0);
    assert.match(r.stderr, /afterAgentThought/);
  });
  it("an ignored tool is allowed silently", () => {
    assert.deepEqual(guardPayload("cursor", cursorTool("Read", { path: "a" }), POLICY), allowResult());
  });
  const selfMerge = "gh pr merge 12 --squash";
  const ownerDeps = {
    allowlist: ["owner"],
    getMerger: () => "owner",
    getPrAuthor: () => "owner",
    getPrBase: () => "feat/x",
  };

  it("passes policy deps through: an allowlisted self-merge is allowed only with them", () => {
    const call = codexTool("Bash", { command: selfMerge });
    assert.deepEqual(guardPayload("codex", call, { policy: ownerDeps }), allowResult());
    // Same command, inert deps: the merger cannot be resolved, so it is refused.
    assert.equal(guardPayload("codex", call, POLICY).exitCode, 2);
  });

  it("accepts a function that builds deps from the normalized payload (cwd, sessionId)", () => {
    const seen = [];
    const r = guardPayload("cursor", cursorShell(selfMerge), {
      policy: (n) => {
        seen.push([n.cwd, n.sessionId]);
        return ownerDeps;
      },
    });
    assert.deepEqual(seen, [["/w", "c1"]]);
    assert.equal(r.exitCode, 0);
  });

  it("fails open LOUDLY when no policy dependencies are supplied", () => {
    for (const options of [undefined, {}, { policy: null }]) {
      const r = guardPayload("codex", codexTool("Bash", { command: badPush }), options);
      assert.equal(r.exitCode, 0);
      assert.match(r.stderr, /guard inactive: no policy dependencies supplied/);
    }
  });

  it("a block result carries sessionId and reason so a wrapper can remember stale context", () => {
    const r = guardPayload("codex", codexTool("Bash", { command: badPush }), POLICY);
    assert.equal(r.sessionId, "s1");
    assert.match(r.reason, /verify/i);
  });
});

describe("edit shapes (parity with guard-quality.mjs)", () => {
  const edits = (tool, input, name = "Edit") =>
    adaptPayload(tool, tool === "codex" ? codexTool(name, input) : cursorTool(name, input)).edits;

  it("reads an edits[] array, one edit per item with its new and old text", () => {
    const got = edits("codex", {
      file_path: "a.ts",
      edits: [{ old_string: "o1", new_string: "n1" }, { old_string: "o2", new_string: "n2" }],
    }, "MultiEdit");
    assert.deepEqual(got, [
      { filePath: "a.ts", added: "n1\nn2", removed: "o1\no2" },
    ]);
  });
  it("reads notebook new_source and notebook_path", () => {
    const got = edits("cursor", { notebook_path: "n.ipynb", new_source: "x = 1" }, "NotebookEdit");
    assert.deepEqual(got, [{ filePath: "n.ipynb", added: "x = 1", removed: "" }]);
  });
  it("judges ALL present text fields, not the first match", () => {
    const got = edits("codex", { file_path: "a.ts", content: "clean", new_string: TS_ANY }, "Write");
    assert.match(got[0].added, /clean/);
    assert.ok(got[0].added.includes(TS_ANY));
  });
  it("blocks when a dirty replacement hides in a MultiEdit batch", () => {
    const call = codexTool("MultiEdit", {
      file_path: "src/a.ts",
      edits: [{ old_string: "a", new_string: "const b = 1;" }, { old_string: "c", new_string: TS_ANY }],
    });
    assert.equal(guardPayload("codex", call, POLICY).exitCode, 2);
  });
  it("blocks a dirty notebook cell", () => {
    const call = cursorTool("NotebookEdit", { notebook_path: "src/n.ts", new_source: TS_ANY });
    assert.equal(guardPayload("cursor", call, POLICY).exitCode, 2);
  });
  it("is unrecognised when a file path is given but no text field at all", () => {
    assert.equal(adaptPayload("codex", codexTool("Edit", { file_path: "a.ts" })).kind, "unrecognised");
  });
});

describe("Cursor preToolUse edit tool names", () => {
  for (const name of ["Write", "Edit", "StrReplace", "MultiEdit", "NotebookEdit", "ApplyPatch", "write", "strreplace"]) {
    it(`treats ${name} as an edit`, () => {
      const n = adaptPayload("cursor", cursorTool(name, { file_path: "a.ts", new_string: "x" }));
      assert.equal(n.kind, "edit");
    });
  }
  for (const name of ["Read", "Grep", "Task", "MCP", "Delete"]) {
    it(`ignores ${name}`, () => {
      assert.equal(adaptPayload("cursor", cursorTool(name, { file_path: "a.ts", new_string: "x" })).kind, "ignore");
    });
  }
  it("reads an ApplyPatch body like Codex apply_patch", () => {
    const patch = "*** Begin Patch\n*** Add File: a.ts\n+hi\n*** End Patch";
    const n = adaptPayload("cursor", cursorTool("ApplyPatch", { command: patch }));
    assert.deepEqual(n.edits, [{ filePath: "a.ts", added: "hi", removed: "" }]);
  });
});

describe("Codex apply_patch renames", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: src/old.js",
    "*** Move to: src/new.ts",
    "@@",
    "-a",
    `+${TS_ANY}`,
    "*** End Patch",
  ].join("\n");
  it("uses the NEW path, so a rename that changes extension is judged by the new type", () => {
    const n = adaptPayload("codex", codexTool("apply_patch", { command: patch }));
    assert.equal(n.edits[0].filePath, "src/new.ts");
  });
  it("blocks a rename into a typed file with a silenced type", () => {
    assert.equal(guardPayload("codex", codexTool("apply_patch", { command: patch }), POLICY).exitCode, 2);
  });
  it("trims line endings only, keeping spaces inside a path", () => {
    const p = "*** Begin Patch\r\n*** Add File: my dir/a b.ts\r\n+x\r\n*** End Patch";
    assert.equal(adaptPayload("codex", codexTool("apply_patch", { command: p })).edits[0].filePath, "my dir/a b.ts");
  });
});

describe("block reason format", () => {
  it("prints file:line for line findings and the bare file for line 0", () => {
    const line = guardPayload("cursor", cursorTool("Write", { file_path: "src/a.ts", content: TS_ANY }), POLICY);
    assert.match(line.stderr, /src\/a\.ts:1 /);
    const gate = guardPayload("codex", codexTool("Edit", {
      file_path: "vitest.config.ts", old_string: "lines: 80", new_string: "lines: 50",
    }), POLICY);
    assert.equal(gate.exitCode, 2);
    assert.match(gate.stderr, /vitest\.config\.ts \[/);
    assert.doesNotMatch(gate.stderr, /:0/);
  });
});
