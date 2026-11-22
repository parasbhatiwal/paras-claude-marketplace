#!/bin/sh
# team-skills-hook.sh: launcher for the team-skills guard hooks on Codex.
#
# Usage (from .codex/hooks.json):  sh .codex/team-skills-hook.sh <wrapper>.mjs
#   e.g. sh .codex/team-skills-hook.sh codex-guard-git.mjs
#
# Finds the NEWEST installed `team-skills` plugin under
#   ${CODEX_HOME:-$HOME/.codex}/plugins/cache/<marketplace>/team-skills/<version>/
# (marketplace name varies; newest = semantic-version order, so 2.10.0 beats
# 2.9.0), then runs that version's hooks/<wrapper> with node. stdin passes
# straight through and the wrapper's exit code is the hook's exit code
# (2 = block).
#
# FAILS OPEN: if the plugin or node cannot be found this prints
# "guard inactive: ..." on stderr and exits 0, so a missing install never
# blocks your work. It makes no network access.
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

# One "version<TAB>directory" line per install that carries the wrapper, sorted
# numerically on major, minor, patch; the last line is the newest.
newest=$(
  for dir in "$cache"/*/team-skills/*/; do
    [ -f "${dir}hooks/$wrapper" ] || continue
    dir=${dir%/}
    printf '%s\t%s\n' "${dir##*/}" "$dir"
  done | sort -t . -k 1,1n -k 2,2n -k 3,3n | tail -n 1 | cut -f 2
)

[ -n "$newest" ] || warn "no team-skills plugin with hooks/$wrapper found under $cache (install the plugin with the Codex plugins command, then start a new session)"

exec node "$newest/hooks/$wrapper"
