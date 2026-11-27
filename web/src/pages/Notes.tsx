import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ClockIcon, CloudArrowUpIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import SortableList from '../components/SortableList'
import { shortDay, todayISO } from '../lib/dates'
import { isTemp } from '../lib/optimistic'
import {
  notesKey,
  useCreateNote,
  useDeleteNote,
  useMoveNote,
  useNotes,
  useUpdateNote,
} from '../lib/notes'
import type { Note } from '../lib/types'

const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Today" or "Nov 18". */
const dayLabel = (iso: string) => (localDay(iso) === todayISO() ? 'Today' : shortDay(iso))

const snippet = (body: string) => body.split('\n').find((l) => l.trim())?.trim() ?? ''

/** Notes (NOTES.md): a list you order by hand, and an editor that saves as you type. */
export default function Notes() {
  const { data: notes, isError } = useNotes()
  const create = useCreateNote()
  const move = useMoveNote()
  const remove = useDeleteNote()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focusTitle, setFocusTitle] = useState<number | null>(null)
  // From search: select that note (and focus its title for "New note").
  const location = useLocation()
  const navigate = useNavigate()
  const fromSearch = location.state as { selectNote?: number; focusTitle?: boolean } | null
  useEffect(() => {
    if (fromSearch?.selectNote === undefined) return
    setQuery('')
    setSelectedId(fromSearch.selectNote)
    if (fromSearch.focusTitle) setFocusTitle(fromSearch.selectNote)
    navigate('.', { replace: true, state: null })
  }, [fromSearch?.selectNote])

  const q = query.trim().toLowerCase()
  const visible = (notes ?? []).filter(
    (n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  )
  // With notes present, the first visible one is selected by default.
  const selected = visible.find((n) => n.id === selectedId) ?? (selectedId === -1 ? undefined : visible[0])

  function onNew() {
    setQuery('')
    create.mutate(undefined, {
      onSuccess: (note) => {
        setSelectedId(note.id)
        setFocusTitle(note.id)
      },
    })
  }

  /** Delete now; Undo puts it back where it was and selects it again (UNDO.md). */
  function onDelete(note: Note) {
    remove(note, () => setSelectedId(note.id))
    // Clear the selection (-1 = "nothing", not "the first one").
    setSelectedId(-1)
  }

  const row = (note: Note, handle: ReactNode) => (
    <div className={`note-row${selected?.id === note.id ? ' is-selected' : ''}`}>
      {handle}
      <button type="button" className="note-row-main" onClick={() => setSelectedId(note.id)}>
        <span className="note-row-text">
          <span className={`note-row-title${note.title ? '' : ' is-empty'}`}>{note.title || 'Untitled note'}</span>
          <span className="note-row-snippet">{snippet(note.body) || 'No text'}</span>
        </span>
        <span className="note-row-date">{dayLabel(note.updated_at)}</span>
      </button>
    </div>
  )

  return (
    <section className="notes" data-screen-label="Notes">
      <div className="notes-header">
        <h1 className="page-title">Notes</h1>
        <button className="btn btn-primary notes-new" onClick={onNew} disabled={create.isPending}>
          <PlusIcon size={16} aria-hidden />
          New note
        </button>
      </div>
      {isError && <p className="muted">Couldn't load your notes.</p>}
      <div className="notes-body">
        <div className="notes-list-col">
          <div className="notes-search">
            <MagnifyingGlassIcon className="notes-search-icon" size={17} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search notes"
              aria-label="Search notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {q && (
            <p className="notes-search-count">
              {visible.length} {visible.length === 1 ? 'match' : 'matches'}. Clear the search to reorder.
            </p>
          )}
          {notes && !q && notes.length > 0 && (
            <SortableList
              items={notes}
              noun="note"
              className="notes-list"
              isLocked={(n) => isTemp(n.id)}
              onMove={(id, placement, order) => move.mutate({ id, placement, order })}
              renderItem={row}
            />
          )}
          {q && visible.length > 0 && (
            <div className="notes-list">
              {visible.map((n) => (
                <div key={n.id}>{row(n, <span className="notes-handle-spacer" aria-hidden />)}</div>
              ))}
            </div>
          )}
          {notes && notes.length === 0 && <p className="muted notes-empty">No notes yet.</p>}
          {notes && notes.length > 0 && q && visible.length === 0 && (
            <p className="muted notes-empty">No notes match "{query.trim()}".</p>
          )}
        </div>
        <div className="notes-editor-col">
          {selected && !isTemp(selected.id) ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              autoFocus={focusTitle === selected.id}
              onDelete={() => onDelete(selected)}
            />
          ) : (
            notes && <p className="muted">Select a note, or start a new one.</p>
          )}
        </div>
      </div>
    </section>
  )
}

type SaveState = 'idle' | 'saving' | 'saved'

/**
 * Autosave like NotesField, but while typing: the list updates on every
 * keystroke, and the PATCH goes 700 ms after typing stops.
 */
function NoteEditor({ note, autoFocus, onDelete }: { note: Note; autoFocus: boolean; onDelete: () => void }) {
  const qc = useQueryClient()
  const update = useUpdateNote()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [save, setSave] = useState<SaveState>('idle')
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<{ title: string; body: string } | null>(null)
  const mutate = useRef(update.mutate)

  const flush = () => {
    window.clearTimeout(timer.current)
    const next = pending.current
    if (!next) return
    pending.current = null
    mutate.current(
      { id: note.id, patch: next },
      { onSuccess: () => !pending.current && setSave('saved') }
    )
  }

  // Switching notes or leaving the page saves what's left.
  const flushRef = useRef(flush)
  useEffect(() => {
    mutate.current = update.mutate
    flushRef.current = flush
  })
  useEffect(() => () => flushRef.current(), [])

  function onEdit(next: { title: string; body: string }) {
    setTitle(next.title)
    setBody(next.body)
    setSave('saving')
    qc.setQueryData<Note[]>(notesKey, (old) =>
      old?.map((n) => (n.id === note.id ? { ...n, ...next, updated_at: new Date().toISOString() } : n))
    )
    pending.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
  }

  return (
    <div className="note-editor">
      <input
        className="note-title-input"
        placeholder="Untitled note"
        aria-label="Title"
        maxLength={200}
        autoFocus={autoFocus}
        value={title}
        onChange={(e) => onEdit({ title: e.target.value, body })}
      />
      <p className="note-status" role="status">
        {save === 'saving' ? (
          <>
            <CloudArrowUpIcon aria-hidden />
            Saving…
          </>
        ) : save === 'saved' ? (
          <>
            <CheckIcon aria-hidden />
            Saved
          </>
        ) : (
          <>
            <ClockIcon aria-hidden />
            Edited {dayLabel(note.updated_at) === 'Today' ? 'today' : dayLabel(note.updated_at)}
          </>
        )}
      </p>
      <textarea
        className="note-body-input"
        placeholder="Write something. Markdown works."
        aria-label="Note"
        value={body}
        onChange={(e) => onEdit({ title, body: e.target.value })}
      />
      <button
        className="btn btn-ghost muted note-delete"
        onClick={() => {
          // Save first, so the save can't land after the delete.
          flush()
          onDelete()
        }}
      >
        <TrashIcon size={16} aria-hidden />
        Delete note
      </button>
    </div>
  )
}
