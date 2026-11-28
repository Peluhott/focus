/**
 * After a goal change that re-grades the to-dos (a goal added, completed,
 * archived, restored or deleted; a sub-goal added or deleted), the server
 * waits until goal edits have been quiet for a minute, then re-checks every
 * open to-do in the background. Nothing shows as "checking" meanwhile, so
 * the to-do polling (useAlignmentPolling) watches for that window instead.
 */

/** Matches the API's aiConfig.contextQuietMs. */
const QUIET_MS = 60_000
/** Start a little early, and keep looking a while: a re-check takes some seconds. */
const LEAD_MS = 5_000
const WATCH_MS = 60_000

let watch = { from: 0, until: 0 }

/** A change that the server answers with a delayed re-check. */
export function expectRecheck() {
  const now = Date.now()
  // Each edit pushes the server's re-check back, so the window moves too.
  watch = { from: now + QUIET_MS - LEAD_MS, until: now + QUIET_MS + WATCH_MS }
}

/** Whether a background re-check may be landing now. */
export function watchingRecheck(now = Date.now()) {
  return now >= watch.from && now <= watch.until
}
