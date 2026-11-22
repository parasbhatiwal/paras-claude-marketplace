#!/bin/sh
# team-skills-hook.sh: launcher for the team-skills guard hooks on Codex.
#
# Usage (from .codex/hooks.json):  sh .codex/team-skills-hook.sh <wrapper>.mjs
#   e.g. sh .codex/team-skills-hook.sh codex-guard-git.mjs
#
# Finds the NEWEST installed `team-skills` plugin under
#   ${CODEX_HOME:-$HOME/.codex}/plugins/cache/<marketplace>/team-skills/<version>/
# (marketplace name varies; only directories named exactly MAJOR.MINOR.PATCH
# count; newest = numeric order, so 2.10.0 beats 2.9.0), then runs that version's hooks/<wrapper> with node. stdin passes
# straight through and the wrapper's exit code is the hook's exit code
# (2 = block).
#
# If the newest valid version does not contain the requested wrapper, nothing
# runs: it warns, naming that version, and allows. It never falls back to an
# older version.
#
# FAILS OPEN: if the plugin or node cannot be found this prints
# "guard inactive: ..." on stderr and exits 0, so a missing install never
# blocks your work. It makes no network access.
#
# Limits: the quality guard only sees edit tools (apply_patch, Edit, Write);
# edits made through shell commands (heredocs, tee, sed -i) bypass it. Its
# override record goes to .agents/engineering-overrides.md.
#
# BEST EFFORT, not verified by the maintainer. Codex hooks are not a hard
# boundary: each hook must be reviewed and trusted once, and the trust bypass
# flag skips them. Git hooks and CI remain the real wall.

warn() {
  printf '[team-skills guard] WARNING: guard inactive: %s. This call is allowed unchecked.\n' "$1" >&2
  exit 0
}

wrapper=${1:-}
case $wrapper in
  '') warn "no wrapper name given to team-skills-hook.sh" ;;
  *[!A-Za-z0-9._-]* | .*) warn "invalid wrapper name '$wrapper'" ;;
esac

command -v node >/dev/null 2>&1 || warn "node is not on PATH"

home=${CODEX_HOME:-${HOME:-}/.codex}
cache=$home/plugins/cache

# One "version<TAB>directory" line per install whose directory name is exactly
# MAJOR.MINOR.PATCH (numbers only; `local`, 2.10.0-rc1 and the like are
# ignored), sorted numerically on major, minor, patch; the last is the newest.
newest=$(
  for dir in "$cache"/*/team-skills/*/; do
    [ -d "$dir" ] || continue
    dir=${dir%/}
    version=${dir##*/}
    printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || continue
    printf '%s\t%s\n' "$version" "$dir"
  done | sort -t . -k 1,1n -k 2,2n -k 3,3n | tail -n 1
)

[ -n "$newest" ] || warn "no team-skills plugin found under $cache (install the plugin with the Codex plugins command, then start a new session)"

tab=$(printf '\t')
version=${newest%%"$tab"*}
dir=${newest#*"$tab"}

# One behaviour, on purpose: only the newest valid version ever runs. If it
# lacks this wrapper (a plugin older than the template), say so by version and
# allow; quietly running an older version's rules would hide the mismatch.
[ -f "$dir/hooks/$wrapper" ] || warn "installed team-skills $version lacks $wrapper; update the plugin"

exec node "$dir/hooks/$wrapper"
