# GitHub operations used by the workflow

Adapted from Matt Pocock's `setup-matt-pocock-skills` GitHub tracker notes
(MIT; see `THIRD_PARTY_NOTICES.md`). Use the `gh` CLI. Infer the repo from the
clone.

- **Create issue:** `gh issue create --title "..." --label "..." --body-file -`
  (heredoc on stdin for multi-line bodies).
- **Read issue:** `gh issue view <n> --json number,title,body,labels,comments`
- **Comment:** `gh issue comment <n> --body-file -`
- **Labels:** `gh issue edit <n> --add-label "..." --remove-label "..."`
- **Close:** `gh issue close <n> --comment "..."`
- **Sub-issue of a parent:** `gh issue create --parent <p> ...`, or
  `gh issue edit <p> --add-sub-issue <child>` (gh 2.94+). Older gh:
  `gh api --method POST repos/<owner>/<repo>/issues/<p>/sub_issues -F sub_issue_id=<child-db-id>`.
  Without sub-issues: put `Part of #<p>` at the top of the child body.
- **Blocking edge:** GitHub native dependencies —
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`
  where the id is the blocker's numeric database id
  (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), not `#n` or `node_id`.
  Where unavailable, a `Blocked by: #a, #b` first line in the child body.
- **Frontier:** open sub-issues of the epic that carry `ready-for-agent`, no
  `agent-working`, and whose blockers are all closed.
- **Claim:** add `agent-working`, then re-read the issue to confirm no other
  run claimed it first; if one did, remove yours and pick another.
- **GitHub Projects v2 (optional mirror):** only if the repo already uses a
  Project; mirror state with `gh project item-edit`. Never read state from it.
