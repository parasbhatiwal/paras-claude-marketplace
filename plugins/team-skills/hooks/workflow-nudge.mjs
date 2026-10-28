/**
 * The standing instruction that makes the v2 workflow start by itself.
 *
 * Skills are chosen by the model reading their descriptions, which is a
 * judgment call that a casual prompt ("add a CSV export button") can miss — and
 * a missed `work` means code written before anyone was grilled. A SessionStart
 * line is read every session, so the entry point is stated here once instead of
 * hoped for.
 *
 * Scoped to task requests on purpose: a question answered through a seven-stage
 * flow would teach people to route around the plugin.
 */
export const WORKFLOW_NUDGE =
  "Team workflow: when the user hands over a task - a feature, a bug, a GitHub " +
  "issue, or a plain requirement to build or change - do not start by writing " +
  "code. Invoke the `route` skill (or `work` directly when it is clearly a task " +
  "to build): it grills the requirement first, then hands off to autonomous " +
  "`deliver`. Plain questions, explanations and read-only exploration do not " +
  "need it; answer those directly.";

/** Join the standing nudge with any freshness notice, nudge last. */
export const withWorkflowNudge = (notice) =>
  notice ? `${notice}\n\n${WORKFLOW_NUDGE}` : WORKFLOW_NUDGE;
