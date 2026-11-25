# Handoff: Project files (Focus App)

Addendum to `README.md` (Project detail, §5). Storage, privacy and API come from `Focus - Project Files, Recurring To-dos & Multi-goal Matching.md` (the feature spec); this file covers the UI.

In the prototype: Projects → "Focus app: Phase 3, Goals" or "Apartment move". The `fileStorage` tweak switches to the not-set-up state.

## Placement
Project detail order: title, fields row, **Details**, **Files**, **Tasks**. Files starts `--space-8` below Details.

## Section
The whole section is the drop zone (`radius --radius-md`).

**Header row** (flex-wrap, `align-items: center`, `space-between`, gap `--space-2 --space-4`, margin-bottom `--space-2`):
- `h3` "Files", followed by the file count: body font 14px, weight 400, `--color-accent-700`, baseline-aligned, gap 8px (same idea as the nav counts). No count when there are no files.
- **Upload** button: `.btn .btn-secondary`, `upload-simple` icon. It opens a native file picker (`multiple`, any type). In the prototype it's a `<label>` over a transparent `<input type="file">`; a button that calls `input.click()` is fine.

**Footnote** under the list (when storage is set up): "Any file type, up to {MAX_UPLOAD_MB} MB each. Files are private to your account." 12px, `--color-neutral-700`, margin-top `--space-2`.

## States

### Empty
One line, no list: `tray-arrow-down` icon 18px + "No files. Drop files here or click Upload." 15px, `--color-neutral-700`, gap 8px, padding `6px 0`.

### Dragging files over
Only when the drag contains files (`dataTransfer.types` includes `"Files"`), so task-reorder drags don't trigger it.
- Section: `outline: 2px dashed var(--color-accent)`, `outline-offset: 10px`, background `--color-accent-100`, plus `box-shadow: 0 0 0 10px var(--color-accent-100)` so the tint fills out to the outline. `transition: background 0.15s`.
- The empty line is replaced by `tray-arrow-down` + "Drop to upload to this project" in `--color-accent-800`.
- Clear on `dragleave` when leaving the section (check `relatedTarget`), and on drop.

### File row
Grid `44px minmax(0, 1fr) auto`, `align-items: center`, gap `--space-3`, padding `6px 0`. Rows are stacked with gap 2px; no dividers.
- **Thumb** 44×44, radius `--radius-md`, background `--color-neutral-200`, overflow hidden.
  - Images: the image itself, `object-fit: cover` (use a small Cloudinary transform, e.g. `c_fill,w_88,h_88`, through the signed URL).
  - Everything else: type icon 24px in `--color-neutral-800` (table below).
- **Name**: link, 16px, `--color-text`, no underline, single line with ellipsis; hover `--color-accent-700` + underline; `title="Open {name}"`. Clicking opens the file.
- **Meta** (margin-top 2px): "{type} · {size} · {date}", 13px, `--color-neutral-700`, ellipsis. Example: "PDF · 1.2 MB · Nov 12".
- **Actions**: four `.btn-ghost .btn-icon` buttons, 32×32, icons 18px, `--color-neutral-700`, gap 2px, each with `aria-label` and `title`: Open (`arrow-square-out`), Download (`download-simple`), Rename (`pencil-simple`), Delete (`trash`).

| Extension | Type label | Icon |
| --- | --- | --- |
| png jpg jpeg gif webp svg heic avif | "{EXT} image" | `file-image` |
| pdf | PDF | `file-pdf` |
| doc docx | Word | `file-doc` |
| xls xlsx | Excel | `file-xls` |
| csv | CSV | `file-csv` |
| ppt pptx | Slides | `file-ppt` |
| zip | ZIP | `file-zip` |
| mp4 mov webm | Video | `file-video` |
| mp3 wav m4a | Audio | `file-audio` |
| txt / md | Text / Markdown | `file-text` |
| other | "{EXT}" or "File" | `file` |

Size: under 1 KB "{n} B"; under 1 MB "{n} KB" (rounded); under 10 MB one decimal ("2.3 MB"); otherwise whole MB. Date: the app's short format ("Nov 12"; year added when not the current year).

Order: newest upload first.

### Uploading
New uploads appear **above** the existing files, one row each, uploading in parallel.
- Same grid. Thumb shows the type icon in `--color-neutral-600`.
- Name 16px `--color-neutral-800`, ellipsis.
- Progress row (margin-top 6px, gap 10px): bar (flex 1, 4px, track `--color-neutral-300`, fill `--color-accent`, radius `--radius-sm`, `transition: width 0.2s`) + "{pct}% of {size}" (12px, tabular numbers, neutral-700).
- Cancel: ghost icon button `x`, "Cancel upload". Aborts the Cloudinary request; no record is saved.
- On success the row turns into a normal file row in place.
- Upload failure (network or Cloudinary error): replace the progress row with an error line (see below) naming the file, with a "Retry" ghost button.

### Too large / errors
Checked before uploading. One line per rejected file, above the list, `role="alert"`:
- `warning-circle` 18px + message + dismiss (`x`, 28×28 ghost icon button). 14px, `--color-accent-2-800`, gap 10px, padding `4px 0`.
- Copy: "{name} is {size}. Files can be up to {MAX_UPLOAD_MB} MB."
- Other files in the same drop still upload.

### File storage not set up
When the API reports Cloudinary isn't configured:
- No Upload button, no count, no footnote, no drop zone.
- `cloud-slash` icon 20px (neutral-700) + two lines: "File storage not set up" (15px) and "Add your Cloudinary credentials to the server to turn on uploads. The rest of the project works as usual." (13px, neutral-700).

## Actions
- **Open:** `GET /files/:id/url` → open the signed URL in a new tab. Request it on click (it expires in 10 minutes), never in advance.
- **Download:** same URL with Cloudinary's `fl_attachment` flag (or `download` attribute where same-origin).
- **Rename:** the name link becomes an `.input` (15px, padding `3px 8px`, background `--color-bg`), autofocused with the current name. Enter or blur saves (`PATCH /files/:id { name }`); Esc cancels; an empty name reverts.
- **Delete:** confirmation dialog: title "Delete this file?", body "“{name}” will be removed from this project and deleted from storage.", action "Delete file". Then remove the row and toast "File deleted" (no Undo, since storage deletion is queued).
- **Delete project:** the confirm body now reads "“{title}” and its tasks and files will be deleted."

## Upload flow (web)
1. Validate size → 2. `POST /projects/:id/files/sign` → 3. upload straight to Cloudinary with progress (XHR `upload.onprogress`) → 4. `POST /projects/:id/files` with Cloudinary's result → 5. replace the uploading row with the returned record.

## Prototype-only
- Uploads are simulated with a timer; uploaded files open from a local blob URL.
- Sample files (seeded on two projects) have no real content; opening one shows a toast. Sample images show the type icon because there's no image behind them.
- `MAX_UPLOAD_MB` is 25 in the prototype. Read the real value from the server.

## Icons
`upload-simple`, `tray-arrow-down`, `warning-circle`, `x`, `cloud-slash`, `arrow-square-out`, `download-simple`, `pencil-simple`, `trash`, and the file-type icons above (all duotone).
