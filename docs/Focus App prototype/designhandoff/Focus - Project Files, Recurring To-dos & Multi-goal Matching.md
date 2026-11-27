# Focus — Project Files, Recurring To-dos & Multi-goal Matching

Nov 22, 2026 · @jav

## Summary

This doc adds three features to [Focus](https://claude.ai/artifact/E927nGQpxFMjLpFTd3tvwN):

1. **Project files.** A Files area on each project, between Details and Tasks, with uploads stored in Cloudinary.
2. **Recurring to-dos.** One to-do that never leaves the list. Each check-off logs a completion, then it resets in place.
3. **Multi-goal matching.** A to-do can match more than one goal. Matching 2 or more goals turns it light green; matching every active goal turns it green. Colors update when goals are added, completed or archived.

## Project files

Each project's detail page gets a Files area between Details and Tasks. Files of any type go to Cloudinary; Focus keeps only the file's metadata.

**On the page**

- Order on the project detail page: Details, then Files, then Tasks.
- Drag files onto the area or click "Upload" to pick them. Several files can upload at once, each with its own progress bar.
- Each file shows its name, type icon, size and upload date. Images also show a small thumbnail.
- Actions per file: open or download, rename, delete (with confirmation).
- When there are no files, the area collapses to one line: "No files. Drop files here or click Upload."

**How uploads work**

- **Web app:** the browser asks the API for a signed upload, then sends the file straight to Cloudinary, so large files never pass through your server. When Cloudinary confirms, the browser sends the result to the API, which saves the file record.
- **API keys:** `POST /projects/:id/files` accepts a multipart upload. The server streams it to Cloudinary and saves the record.
- Uploads use `resource_type: "auto"`, so images, video, audio and documents all work. Documents (PDF, Word, CSV, ZIP and so on) are stored as `raw`.
- Files go in a folder per project, e.g. `focus/projects/<project_id>/`.
- Maximum file size is set by `MAX_UPLOAD_MB`, kept at or below your Cloudinary plan's per-file limit. Too-large files are rejected before upload with a clear message.

**Privacy**

- Files are uploaded as `authenticated`, so their Cloudinary links don't work on their own.
- Opening a file asks the API for a short-lived signed URL (valid 10 minutes). Only you, logged in or with a key that has `projects:read`, can get one.
- On the free plan, enable "Allow delivery of PDF and ZIP files" in Cloudinary's Security settings, or PDFs and ZIPs will upload but not open.

**Deleting**

- Deleting a file removes the record right away and deletes it from Cloudinary in a background job, which retries if Cloudinary is down.
- Deleting a project queues deletion of all its files the same way.
- If Cloudinary isn't configured, the Files area shows "File storage not set up" and the rest of the project page works normally.

## Recurring to-dos

A recurring to-do is one item that never leaves the list. Each time you check it, Focus logs a completion and the checkbox resets in place. No copies are created and nothing is cleared.

**Making one**

- Any to-do can be switched to recurring with a "Repeat" toggle in its menu, or by setting `recurring: true` through the API.
- Recurring to-dos show a small repeat icon next to the checkbox.
- A recurring to-do has no date. The date button is hidden while Repeat is on, so it never appears on the calendar.

**Checking it off**

- The checkbox fills for about 1 second, a completion is logged, then it unchecks itself. The item keeps its spot in the list.
- A 5-second Undo toast removes that logged completion if you tapped by mistake.
- You can check it as many times as you like, including several times a day. Each check is one completion.
- The item shows its tally: "Done 14×" and "✓ today" once it's been checked today.
- **If it's red** (matches no goal or project), checking it moves it to the off-track backlog like any other red to-do. It stops recurring and no completion is logged.

**How completions count**

- The completion-tracking display you already have stays as it is. This feature only adds recurring check-offs to the data it counts.
- Each recurring check-off is saved as its own completion entry with a timestamp, the same as a normal to-do being completed.
- So 5 check-offs of one recurring to-do count as 5 completions, while the to-do itself stays a single item on the list.

**Stopping one**

- Turn Repeat off: it becomes a normal to-do; its past completions stay counted.
- Delete it: it's removed from the list; its past completions stay counted.

## Multi-goal matching

The alignment check now links a to-do to every active goal it serves, not just the best one. Its color shows how many: light green for 2 or more goals, green for all of them.

**Colors**

| To-do matches | Display | Example with 3 active goals |
| --- | --- | --- |
| No goal and no project | Red (unchanged) | 0 of 3 |
| A project only, or 1 goal | No highlight, goal or project chip | 1 of 3 |
| 2 or more goals, but not all | Light green, label "2 goals" | 2 of 3 |
| Every active goal | Green, label "All goals" | 3 of 3 |

- "All" means all goals active right now. With 2 active goals, matching both is green, so light green can't happen. With 1 active goal, matching it is green.
- Each matched goal shows as a chip on the to-do (up to 3, then "+N").
- Green shades use the same tokens in light and dark mode, and the label carries the meaning, so color is never the only signal.
- Red to-dos and the off-track backlog work exactly as before. Recurring to-dos get colors too.

**Keeping colors current**

- Each match is stored as a link between the to-do and a goal. The color is worked out from those links and the current number of active goals, with no AI call.
- **Archive or complete a goal:** links to that goal stop counting and colors update instantly. A to-do that matched 2 of 3 goals turns green if the goal it didn't match is archived (2 of 2).
- **A to-do loses its only matched goal:** it's re-checked, since it may match another goal or project, or turn red.
- **Add a goal, restore one, or edit a goal's details or sub-goals:** open to-dos are re-checked in one batched job, because new matches may appear.

**Model output change**

```json
{
  "aligned": true,
  "matches": [
    { "type": "goal", "id": "g_2", "confidence": 0.84 },
    { "type": "goal", "id": "g_5", "confidence": 0.71 },
    { "type": "project", "id": "p_9", "confidence": 0.77 }
  ],
  "reason": "Supports both the portfolio and job-search goals."
}
```

Only matches with confidence of 0.6 or more are saved, the same threshold used for red.

## Data model and API changes

Three new tables, two new fields on Todo, and the single goal and project match fields replaced by a link table.

**New tables**

| Table | Key fields | Notes |
| --- | --- | --- |
| ProjectFile | id, project\_id, name, cloudinary\_public\_id, resource\_type (image, video, raw), format, bytes, uploaded\_at | Metadata only; the file lives in Cloudinary |
| TodoCompletion | id, todo\_id (nullable, kept if the to-do is deleted), title\_snapshot, completed\_at | One row per check-off, normal or recurring |
| TodoMatch | todo\_id, target\_type (goal, project), target\_id, confidence, created\_at | Replaces `matched_goal_id` and `matched_project_id` |

**Todo changes**

- Add `recurring` (boolean, default false) and `completion_count` (a cached count of its TodoCompletion rows).
- Remove `matched_goal_id` and `matched_project_id`; matches now live in TodoMatch.
- Responses include `matches` (the list of linked goals and projects) and `match_level`: `none`, `one`, `several` or `all`.

**New endpoints**

| Resource | Endpoints | Scope |
| --- | --- | --- |
| Project files | `GET /projects/:id/files`, `POST /projects/:id/files/sign`, `POST /projects/:id/files`, `PATCH /files/:id`, `DELETE /files/:id`, `GET /files/:id/url` | `projects:read` / `projects:write` |
| Completions | `GET /completions?from=&to=` (list and total), `DELETE /completions/:id` (undo) | `todos:read` / `todos:write` |

**Changed behavior**

- `POST /projects/:id/files/sign` returns the signature for a direct browser upload. `POST /projects/:id/files` either takes a multipart upload (API clients) or saves the result of a direct upload (web app).
- `GET /files/:id/url` returns a signed URL valid for 10 minutes.
- `PATCH /todos/:id` with `{ "done": true }` on a recurring to-do logs a completion and returns it with `done: false` and the new `completion_count`.
- Deleting a project or file queues deletion from Cloudinary in the background.
