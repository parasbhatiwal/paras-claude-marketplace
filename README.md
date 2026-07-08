# Claude Marketplace

Central marketplace for Claude Code skills shared across all our projects.
Author skills **here once**; every project that enables this marketplace picks
up updates automatically (plugins update from this git repo).

## Layout

```
.claude-plugin/marketplace.json      # index of plugins in this repo
plugins/team-skills/
  .claude-plugin/plugin.json         # plugin manifest
  skills/<name>/SKILL.md             # one folder per skill
examples/project-settings.json       # snippet to bake into each project
```

## Adding a skill

1. Create `plugins/team-skills/skills/<your-skill>/SKILL.md`.
2. Give it YAML frontmatter with `name` and a trigger-focused `description`.
3. Commit and push. Enabled projects get it on their next session.

## Enabling it in a project (no per-machine setup)

Copy the contents of `examples/project-settings.json` into the project's
`.claude/settings.json` (merge if the file already exists). Commit it. Any repo
carrying this file auto-registers the marketplace and enables the plugin — no
`/plugin` command and nothing added to each developer's `~/.claude`.

Bake it into your starter/template repo so every new project inherits it.

## Note on private repos

If this repo is private, each developer's machine needs normal git auth to it
(their existing GitHub SSH key or token — nothing Claude-specific). A public
repo removes even that.
