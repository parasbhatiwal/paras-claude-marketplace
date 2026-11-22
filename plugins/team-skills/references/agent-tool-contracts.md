# Codex and Cursor contracts

What this plugin needs to know about how **OpenAI Codex** and **Cursor** read
plugins, marketplaces, skills and hooks. Every tool-facing manifest, hook
wrapper and install instruction in this repo cites this file. Claude Code's own
contracts are not repeated here.

**Source of truth: official documentation only.** Blogs and community guides
were not used. Facts below were read from the official pages listed with each
section on **2026-11-22**. They were *not* re-fetched while writing this file,
and no tool was run. Nobody on the project can run Codex or Cursor, so every
claim about either tool is **best effort, not verified by the maintainer**.
Re-check the live page before relying on a detail that matters, and update this
file in the same change as the manifest or hook that depends on it.

Anything that could not be confirmed is listed in
[Unconfirmed](#unconfirmed-and-the-decision-already-made) with the decision
already made for it. Do not guess past that list.

## Codex

### Plugin manifest

Sources: <https://developers.openai.com/plugins/build/plugins>,
<https://developers.openai.com/plugins/deploy/submission>.

- **Portable format (preferred):** `plugin.json` at the plugin root, declaring
  `"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`.
  Only `name` is required there: lowercase letters, digits and single hyphens,
  at most 64 characters. `version`, `description`, `author`, `homepage`,
  `repository`, `license`, `keywords` and `extensions` are optional.
- **Compatibility fallback:** `.codex-plugin/plugin.json` is still supported.
  In that format `version`, `description`, `author.name` and an `interface`
  object (display name, short and long description, developer name, category)
  are required, and `$schema` is omitted. It also declares `skills` (a relative
  directory such as `./skills/`) and `mcpServers`.
- **Skills:** a portable package auto-discovers a root `skills/` directory.
- **Hooks:** default `hooks/hooks.json`; override with the
  `extensions.com.openai.hooks` key (path, array or inline object). The
  packaging page documents plugin lifecycle hooks only for plugins installed
  manually in the Codex desktop app, and says plugins with hooks are not
  eligible for the public directory.
- **Commands:** no plugin field for commands exists in the pages read.

### Repo marketplace

Source: <https://developers.openai.com/plugins/build/plugins> (packaging).

- **File:** `$REPO_ROOT/.agents/plugins/marketplace.json` (personal:
  `~/.agents/plugins/marketplace.json`). The desktop app also reads a legacy
  `.claude-plugin/marketplace.json`; that is stated for the desktop app only.
- **Shape:** top-level `name`; optional `interface.displayName`; `plugins[]`.
  Each entry has `name`, `source`, `policy` and `category`. `source` is either a
  string or `{"source": "local", "path": "./plugins/<name>"}`; the path is
  relative to the marketplace root and must start with `./`. Git sources use
  `"source": "url"` or `"git-subdir"` with `url`, `path`, and `ref` or `sha`.
  Always include `policy.installation`, `policy.authentication` and `category`
  (installation values include `AVAILABLE`, `INSTALLED_BY_DEFAULT`,
  `NOT_AVAILABLE`).
- **CLI:** `codex plugin marketplace add owner/repo`,
  `codex plugin marketplace add owner/repo --ref <ref>`,
  `codex plugin marketplace add ./local-marketplace-root`,
  `codex plugin marketplace list`, `... upgrade [name]`, `... remove <name>`.
  Installing happens inside a session through the plugins command, then start a
  new session.
- **Install cache:** `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`.
- **Per-repo enable:** `[plugins."<plugin>@<marketplace>"]` with
  `enabled = true` in `.codex/config.toml`, loaded for trusted projects only.

### Skills

Source: <https://learn.chatgpt.com/docs/build-skills>.

- Discovered in `.agents/skills` from the working directory up to the repo
  root, plus `~/.agents/skills` and `/etc/codex/skills`. Symlinked skill folders
  are supported. `.claude/skills` is **not** read.
- `SKILL.md` must have `name` and `description`; no other frontmatter field is
  documented. An optional `agents/openai.yaml` holds interface and policy.
- Invoked explicitly with a `$` mention (or the skills list), or implicitly when
  the task matches the description.

### Hooks

Source: <https://learn.chatgpt.com/docs/hooks>.

- **Config locations:** `/etc/codex/hooks.json` (system), `~/.codex/hooks.json`
  (user, `$CODEX_HOME`), `.codex/hooks.json` (trusted project), or inline under
  `[hooks]` in `config.toml`. Hooks are on by default (`hooks = false` under
  `[features]` turns them off).
- **Shape:** `{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks":
  [{"type": "command", "command": "...", "timeout": 30}]}]}}`. `timeout` is in
  seconds, default 600.
- **Events:** SessionStart, SessionEnd, PreToolUse, PermissionRequest,
  PostToolUse, PreCompact, PostCompact, UserPromptSubmit, PreModelRequest,
  PostModelRequest, SubagentStart, SubagentStop, Stop, Interrupt.
- **Payload (stdin, one JSON object):** common fields `session_id`,
  `transcript_path`, `cwd`, `hook_event_name`, `model`. `PreToolUse` adds
  `turn_id`, `tool_name`, `tool_use_id`, `tool_input` and `permission_mode`. For
  shell commands and `apply_patch`, `tool_input.command` holds the command text.
- **`PreToolUse` coverage:** shell commands and unified exec (matched as
  `Bash`), `apply_patch` (matchable as `apply_patch`, `Edit` or `Write`), MCP
  tools (for example `mcp__server__tool`) and other local function tools.
  Hosted tools such as web search are not covered.
- **Block:** exit code 2 with the reason on stderr; or JSON on stdout
  `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision":
  "deny", "permissionDecisionReason": "..."}}`; an older
  `{"decision": "block", "reason": "..."}` is also accepted. Exit 0 with no
  output is success. `permissionDecision: "ask"` and `continue: false` are
  parsed but **not supported** in `PreToolUse`: the run is marked failed and the
  tool call continues.
- **Trust:** a non-managed hook must be reviewed and trusted once (keyed to a
  hash of the hook definition) through the hooks command. A bypass flag,
  `--dangerously-bypass-hook-trust`, skips this for one invocation, so these
  hooks are **not** a hard enforcement boundary.

### Instructions and commands

Sources: <https://learn.chatgpt.com/docs/agent-configuration/agents-md>,
<https://learn.chatgpt.com/docs/developer-commands?surface=cli>.

- Codex reads `AGENTS.md`: global (`~/.codex`), then from the repo root down to
  the working directory, one file per directory, closer files win. Combined size
  is capped (`project_doc_max_bytes`, 32 KiB by default). `CLAUDE.md` is not
  read.
- No file-based custom slash commands or custom prompts were found. Built-in
  commands include the plugins, skills, hooks, MCP and init commands.

## Cursor

### Plugin manifest

Sources: <https://cursor.com/docs/plugins>,
<https://cursor.com/docs/reference/plugins>.

- **Cursor format:** `.cursor-plugin/plugin.json`. Only `name` is required
  (lowercase kebab-case, letters, digits, hyphens and periods, starting and
  ending alphanumeric). Optional: `description`, `version` (semver), `author`
  (`name` required, `email` optional), `homepage`, `repository`, `license`,
  `keywords`, `logo`, and component paths `rules`, `agents`, `skills`,
  `commands` (string or array), `hooks` (path or inline object), `mcpServers`
  and `variables`.
- **Discovery when a field is absent:** `skills/` (each folder with
  `SKILL.md`), `rules/`, `agents/`, `commands/`, `hooks/hooks.json`, `mcp.json`.
  A manifest path **replaces** folder discovery for that component.
- **Open standard:** Cursor also supports the Agent Plugins standard, a root
  `plugin.json` carrying the components skills and MCP servers only. Cursor
  plugins carry more components and evolve in parallel.
- **Plugin root variable:** `CURSOR_PLUGIN_ROOT` (the standard's
  `PLUGIN_ROOT` is not expanded in MCP config).
- **Plugin hooks** run command hooks only.

### Marketplace

Sources: same two pages.

- **File:** `.cursor-plugin/marketplace.json` at the repo root.
- **Required:** `name` (kebab-case), `owner` (`name` required, `email`
  optional), `plugins` (each entry needs `name`; `source` is the plugin
  directory path, a string or an object with `path`). Optional `metadata`
  (`description`, `version`, `pluginRoot`). For `"source": "my-plugin"` Cursor
  reads `my-plugin/.cursor-plugin/plugin.json` and merges, manifest values
  winning.
- **Adding a repo:** Customize, then import from a GitHub repository; the repo
  needs a `.cursor-plugin/marketplace.json`. Team marketplaces (Dashboard,
  Plugins) exist on Teams and Enterprise plans. **No way to pin a branch or ref
  was found**, so users may track the default branch.

### Skills

Source: <https://cursor.com/docs/skills>.

- Discovered in `.agents/skills`, `.cursor/skills`, and (for compatibility)
  `.claude/skills` and `.codex/skills`, project and user level, nested folders
  included.
- `name` (must match the folder) and `description` are required. Optional:
  `paths`, `disable-model-invocation`, `icon`, `color`, `metadata`.
- Invoked automatically by relevance, or typed as `/skill-name`.

### Hooks

Source: <https://cursor.com/docs/hooks>.

- **Config:** `.cursor/hooks.json` (project), `~/.cursor/hooks.json` (user),
  enterprise and team locations. Shape: `{"version": 1, "hooks": {"<event>":
  [{"command": "...", "type": "command", "timeout": 30, "failClosed": false,
  "matcher": "..."}]}}`. `version` is required. Plugin hooks load after these.
- **Events used by this plugin:**
  - `beforeShellExecution` — payload has `command`, `cwd`, `sandbox`.
  - `preToolUse` — fires for all tools; payload has `tool_name` (for example
    `Shell`, `Read`, `Write`, `MCP`, `Task`), `tool_input`, `tool_use_id`,
    `cwd`, `agent_message`.
  - `sessionStart` — output may carry `env` and `additional_context`.
  - `afterFileEdit` — payload has `file_path` and `edits`.
- **Common stdin fields:** `conversation_id`, `generation_id`, `model`,
  `hook_event_name`, `cursor_version`, `workspace_roots`, `transcript_path`.
- **Block:** exit code 2, or JSON `{"permission": "deny", "user_message": "...",
  "agent_message": "..."}`. For permission hooks an invalid response also
  blocks. Other non-zero exits, crashes and timeouts **fail open** unless
  `failClosed` is set.
- **`ask`:** accepted by the schema but **not enforced** for `preToolUse`.
- **Cloud agents:** shell and tool hooks run; `sessionStart` does not.
- **Claude compatibility:** by default Cursor also loads Claude Code hook
  settings from `.claude/settings.json` and maps the matching event names, so a
  project with both may run a guard twice. Blocking is idempotent, so this is
  harmless.

### Instructions and commands

Sources: <https://cursor.com/docs/context/rules>,
<https://cursor.com/docs/plugins>.

- `AGENTS.md` is supported in the project root and subdirectories, nested files
  combine with the more specific winning. Project rules are `.cursor/rules/*.mdc`
  (plain `.md` there is ignored).
- Plugins may bundle `commands/` (`.md`, `.mdc`, `.markdown`, `.txt`, with
  `name` and `description` frontmatter). This plugin ships none: skills are
  invoked as `/skill-name`.

## Observed with the real Codex CLI

Run by hand on 2026-11-22 against `@openai/codex` 0.171.0, offline, with a
throwaway `CODEX_HOME`, using this repo's own manifests. These are observations,
not documentation, so they can change; `scripts/codex-smoke.mjs` re-checks them
in CI (advisory).

- `codex plugin marketplace add <local repo path>` accepts the repo and reads
  `.agents/plugins/marketplace.json`; `codex plugin marketplace list` shows it.
- `codex plugin list` shows the plugin as **not installed** with no version
  until it is added; after `codex plugin add <plugin>@<marketplace>` it reports
  **installed, enabled** with the plugin version.
- The install lands in `<CODEX_HOME>/plugins/cache/<marketplace>/<plugin>/<version>/`,
  matching the documented layout, with all of the plugin's skills under
  `skills/`. The plugin's `hooks/` directory is copied too but nothing runs.
- A plugin entry can be enabled in `config.toml` as
  `[plugins."<plugin>@<marketplace>"]`.
- No network or credentials are needed for a local marketplace.

This is the first run of the Codex manifests through the real tool. It does not
show that the skills behave well inside a session, nor anything about hooks.

## Unconfirmed, and the decision already made

| Not confirmed from official docs | Decision |
|---|---|
| Minimum Codex CLI version for plugins and the marketplace commands | Do not state one; docs say "recent Codex CLI" |
| Plugin-root variable available to Codex hook commands | Locate the plugin through the Codex cache layout above; fail open with a warning if not found |
| Whether the Codex CLI (not only the desktop app) reads `.claude-plugin/marketplace.json` | Do not rely on it; ship the Codex marketplace file |
| Custom slash commands or prompts in Codex | None shipped; document `$skill` invocation |
| Whether `ask` is enforced on Cursor `beforeShellExecution` | Never return `ask`; only block or allow |
| Cursor project-level custom command paths | Not used; no Cursor commands shipped |
| Whether a schema key is accepted in a Cursor plugin manifest | Omit it |
| Exact `tool_input` field names for Cursor `Write` and Codex `apply_patch` | Quality guard is best effort: warn and allow when the needed fields are absent |
| Codex `SessionStart` output for adding context | Session nudge is best effort on Codex |
| Cursor reading `CLAUDE.md` | Rely on `AGENTS.md` only |
| Cursor branch pinning on import | Document the limit; do not claim `stable` pinning for Cursor |
| Whether an empty `commands` array or an empty hooks object really disables default folder discovery | Both manifests declare them empty anyway, because default discovery would load this plugin's Claude-format `commands/` and `hooks/hooks.json` (which refer to the Claude plugin-root variable). A manifest path is documented to replace discovery, so this is the safest declaration; revisit when real hooks ship |
| Whether Cursor's marketplace `source` accepts a leading `./` | Written as `plugins/team-skills`, the form the official examples use |
| Allowed values of Codex `policy.installation`, `policy.authentication` and `category` | Only values shown in the official examples are used: `AVAILABLE`, `ON_INSTALL`, `Productivity` |

## Hook contract in one table

| | Claude Code (reference) | Cursor | Codex |
|---|---|---|---|
| Shell event | `PreToolUse` on `Bash` | `beforeShellExecution` | `PreToolUse` on `Bash` |
| Command field | `tool_input.command` | `command` (top level) | `tool_input.command` |
| Block | exit code 2, reason on stderr | exit code 2 or `permission: deny` JSON | exit code 2 or `permissionDecision: deny` JSON |
| `ask` | n/a here | not enforced on `preToolUse` | not supported in `PreToolUse` |
| Bad payload / crash | wrapper exits 0 | fails open unless `failClosed` | tool call continues |
| Needs trust | no | no | yes, once per hook definition |
