# Focus — Off-track Backlog, Goal Suggestions & Calendar

Nov 21, 2026 · @jav

## Summary

This doc adds three features to [Focus](https://claude.ai/artifact/E927nGQpxFMjLpFTd3tvwN):

1. **Off-track backlog.** Checking off a red to-do moves it to a permanent off-track backlog instead of completing it.
2. **Goal suggestions.** When you complete a goal or raise your goal limit, the AI reads the backlog and suggests up to 3 new goals built from recurring themes. You accept, edit or dismiss each one.
3. **Calendar view.** A separate page showing the current month, with every dated to-do placed on its day.

The backlog and suggestions follow the main spec's "optional by design" rules: if the AI is off or failing, completing a goal works exactly as before. The calendar uses no AI.

## Off-track backlog

The backlog is where red to-dos go once you acknowledge them. Checking off a red to-do doesn't complete it; it moves it here.

**How a to-do gets here**

- A red to-do can leave the to-do list in only two ways: delete it (gone, nothing saved) or check it off.
- On a red to-do, the checkbox's tooltip reads "Move to off-track." Checking it moves the to-do into the backlog. It is not counted as done.
- The entry keeps a snapshot of the title, notes, the AI's reason and the date it was moved.
- If a re-check clears the red first (because you added or updated a goal or project that it matches), the checkbox goes back to a normal complete.

**What happens to an entry**

| Event | Entry status |
| --- | --- |
| Used in a suggested goal you accept | `used` |
| You remove it from the backlog by hand | `cleared` |
| Anything else | Stays `open` and feeds future goal suggestions |

**Where you see it**

- A collapsed "Off-track backlog (N)" panel at the bottom of the Goals page.
- Each row shows the text, the AI's reason and the date it was moved.
- Actions: remove one entry, or "Clear all." Nothing else; the backlog is a record, not a second to-do list.

## Goal suggestions

Completing a goal or raising your focus limit (say, from 3 to 5) opens up spots. At that moment the AI reads the open backlog and suggests up to 3 goals, each built from a theme that shows up in at least 3 items.

&#91;embedded content: goal suggestion flow · 2 checks, 1 outcome\]

If the AI is off, the backlog has fewer than 3 open items, or no theme is strong enough, you just see the completed goal and nothing else.

**When it runs**

- Triggered by two events only: completing a goal, or raising the focus limit, from the UI or the API. The change is saved first; the run is queued after. Archiving a goal or lowering the limit never triggers it, and there is no manual button.
- Skipped when the AI is off or fewer than 3 backlog items are open.
- One set of suggestions at a time. A new run marks any undecided suggestions from the previous run as dismissed.

**What the model sees**

- Open backlog items, newest first, capped at 200: text, notes, the flag reason, and the date it was moved.
- Your active goals (titles and details), so it doesn't suggest something you already have.
- The title of the goal you just completed, when that's the trigger.

**What it returns** (structured JSON, validated)

```json
{
  "suggestions": [
    {
      "title": "Ship a public portfolio of side projects",
      "details": "Several off-track to-dos were about polishing and publishing small tools.",
      "sub_goals": ["Pick 3 projects to feature", "Write a README for each", "Publish the portfolio page"],
      "item_ids": ["ot_12", "ot_19", "ot_27"],
      "rationale": "3 items over 5 weeks about publishing work."
    }
  ]
}
```

The server drops any suggestion that points to fewer than 3 real open backlog items, and drops near-duplicates of active goals.

**How it's shown**

- A "Suggested goals" panel opens on the Goals page with one card per suggestion: title, details, proposed sub-goals, the reasoning, and an expandable "Based on N items" list.
- **Accept** creates an active goal with those sub-goals and marks its items `used`.
- **Edit** opens the goal editor pre-filled; saving creates the goal the same way.
- **Dismiss** removes the card. Its items stay open in the backlog for future runs.
- Accept follows the focus limit. If you've filled the spot since, Accept is disabled with the usual limit message.
- Undecided cards stay available behind a "Suggestions (N)" link on the Goals page.
- An empty run shows one quiet line: "No clear themes in your backlog yet." A failed run shows nothing.

**Optional by design**

Same rules as the alignment check: separate worker, 10-second timeout, at most 2 retries, circuit breaker, spend cap. Completing a goal behaves identically with the AI off.

## Calendar view

A separate "Calendar" page that shows the current month as a grid, with each dated to-do on its day. It's read-only and has no other controls.

**What it shows**

- The current month only, Sunday to Saturday, with today highlighted. No previous/next arrows.
- Only to-dos that have a date. Project tasks never appear here; they're managed through the API.
- Completed to-dos are not shown. Overdue items stay on their original day; nothing from earlier months is pulled in.
- No AI state (no red highlights). The calendar only answers "what's due when."

**Behavior**

- Each day shows up to 3 items, then "+N more," which opens a small list for that day.
- Clicking a to-do opens the to-do page scrolled to that item.
- No creating, editing, dragging or rescheduling from the calendar.
- On a phone-width screen, the grid becomes a list of days that have items.
- Dates are plain calendar dates (no time of day), so nothing shifts across time zones.

**Data**

- One request: `GET /api/v1/calendar?month=2026-11` returns `{ date, id, title }` for every open dated to-do in that month.
- The page always asks for the current month. The endpoint takes `month` so the API stays general.

## Data model and API changes

Three new tables and a handful of endpoints. The calendar needs no new tables.

**New tables**

| Table | Key fields | Notes |
| --- | --- | --- |
| OffTrackItem | id, todo\_id (nullable, set to null on delete), title\_snapshot, notes\_snapshot, reason, status (open, used, cleared), moved\_at, used\_in\_goal\_id (nullable) | One row per to-do moved to the backlog |
| GoalSuggestionRun | id, trigger (goal\_completed, limit\_raised), trigger\_goal\_id (nullable), status (queued, ready, empty, error, skipped), item\_count, model, input\_tokens, output\_tokens, created\_at | One per goal completion or limit increase |
| GoalSuggestion | id, run\_id, title, details, sub\_goals (JSON list of titles), item\_ids (JSON list of OffTrackItem ids), rationale, status (open, accepted, dismissed), accepted\_goal\_id (nullable) | Up to 3 per run |

**New endpoints**

| Resource | Endpoints | Scope |
| --- | --- | --- |
| Off-track backlog | `GET /off-track?status=open`, `DELETE /off-track/:id`, `POST /off-track/clear` | `goals:read` / `goals:write` |
| Goal suggestions | `GET /goal-suggestions?status=open`, `POST /goal-suggestions/:id/accept`, `POST /goal-suggestions/:id/dismiss` | `goals:read` / `goals:write` |
| Calendar | `GET /calendar?month=YYYY-MM` | `todos:read` |

**Changed endpoints**

- `POST /goals/:id/complete` also returns `suggestion_run_id` (or `null` when the AI is off or skipped). The goal is completed before anything is queued, as with to-do saves.
- `POST /goal-suggestions/:id/accept` takes optional edits (`title`, `details`, `sub_goals`) and returns `201` with the new goal, or `409 goal_limit_reached` if the slot has been filled since.

Raising `focus_limit` through `PATCH /settings` returns `suggestion_run_id` the same way. Lowering it returns `null`.
