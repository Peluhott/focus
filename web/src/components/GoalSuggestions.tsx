import { useState } from 'react'
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleIcon,
  PencilSimpleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { shortDay } from '../lib/dates'
import {
  useAcceptSuggestion,
  useDismissSuggestion,
  type SuggestionEdits,
} from '../lib/suggestions'
import type { GoalSuggestion } from '../lib/types'

const LIMIT_NOTE = "You're at your limit. Complete or archive a goal, or raise your limit."

/**
 * "Suggested goals" (docs "Goal suggestions"): one card per suggestion with
 * Accept, Edit and Dismiss. Accept follows the focus limit.
 */
export default function GoalSuggestions({
  suggestions,
  atLimit,
  onHide,
}: {
  suggestions: GoalSuggestion[]
  atLimit: boolean
  onHide: () => void
}) {
  return (
    <section className="suggestions" aria-labelledby="suggestions-title">
      <div className="suggestions-head">
        <div>
          <h2 id="suggestions-title" className="suggestions-title">
            Suggested goals
          </h2>
          <p className="suggestions-sub">From recurring themes in your off-track backlog.</p>
        </div>
        <button className="btn btn-ghost" onClick={onHide}>
          Hide
        </button>
      </div>
      <div className="goal-list suggestion-list">
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} atLimit={atLimit} />
        ))}
      </div>
    </section>
  )
}

function SuggestionCard({ suggestion, atLimit }: { suggestion: GoalSuggestion; atLimit: boolean }) {
  const accept = useAcceptSuggestion()
  const dismiss = useDismissSuggestion()
  const [editing, setEditing] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const busy = accept.isPending

  if (editing) {
    return (
      <SuggestionEditor
        suggestion={suggestion}
        atLimit={atLimit}
        busy={busy}
        onSave={(edits) => accept.mutate({ id: suggestion.id, edits })}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <article className="card suggestion-card" aria-label={`Suggested goal: ${suggestion.title}`}>
      <span className="card-kicker">Suggested goal</span>
      <h3 className="suggestion-goal">{suggestion.title}</h3>
      {suggestion.details && <p className="suggestion-details">{suggestion.details}</p>}
      {suggestion.sub_goals.length > 0 && (
        <ul className="suggestion-subs">
          {suggestion.sub_goals.map((t, i) => (
            <li key={i}>
              <CircleIcon aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
      {suggestion.rationale && <p className="suggestion-why">{suggestion.rationale}</p>}
      <div>
        <button
          className="btn btn-ghost small-toggle"
          aria-expanded={itemsOpen}
          onClick={() => setItemsOpen((o) => !o)}
        >
          {itemsOpen ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
          Based on {suggestion.items.length} {suggestion.items.length === 1 ? 'item' : 'items'}
        </button>
        {itemsOpen && (
          <ul className="suggestion-items">
            {suggestion.items.map((i) => (
              <li key={i.id}>
                <span>{i.title}</span>
                <span className="suggestion-item-date">{shortDay(i.moved_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="suggestion-actions">
        <button
          className="btn btn-primary"
          disabled={atLimit || busy}
          title={atLimit ? LIMIT_NOTE : undefined}
          onClick={() => accept.mutate({ id: suggestion.id })}
        >
          <CheckCircleIcon size={16} aria-hidden />
          Accept
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setEditing(true)}>
          <PencilSimpleIcon size={16} aria-hidden />
          Edit
        </button>
        <button
          className="btn btn-ghost muted"
          disabled={busy}
          onClick={() => dismiss.mutate({ id: suggestion.id })}
        >
          <XIcon size={16} aria-hidden />
          Dismiss
        </button>
      </div>
      {atLimit && <p className="note">{LIMIT_NOTE}</p>}
    </article>
  )
}

/** "Edit": the goal pre-filled; saving creates it the same way Accept does. */
function SuggestionEditor({
  suggestion,
  atLimit,
  busy,
  onSave,
  onCancel,
}: {
  suggestion: GoalSuggestion
  atLimit: boolean
  busy: boolean
  onSave: (edits: SuggestionEdits) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(suggestion.title)
  const [details, setDetails] = useState(suggestion.details)
  const [subs, setSubs] = useState(suggestion.sub_goals)
  const [subDraft, setSubDraft] = useState('')
  const valid = title.trim().length > 0

  return (
    <article className="card suggestion-card" aria-label="Edit suggested goal">
      <span className="card-kicker">Edit suggested goal</span>
      <div className="field">
        <label htmlFor={`sg-title-${suggestion.id}`}>Title</label>
        <input
          id={`sg-title-${suggestion.id}`}
          className="input on-bg"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`sg-details-${suggestion.id}`}>Details</label>
        <textarea
          id={`sg-details-${suggestion.id}`}
          className="input on-bg"
          style={{ minHeight: 80 }}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>
      <div className="field">
        <span className="field-label">Sub-goals</span>
        {subs.map((t, i) => (
          <div key={i} className="suggestion-edit-sub">
            <input
              className="input on-bg"
              aria-label={`Sub-goal ${i + 1}`}
              value={t}
              onChange={(e) => setSubs((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              className="btn btn-ghost btn-icon tiny-icon muted"
              aria-label="Remove sub-goal"
              onClick={() => setSubs((s) => s.filter((_, j) => j !== i))}
            >
              <XIcon aria-hidden />
            </button>
          </div>
        ))}
        <input
          className="input on-bg"
          placeholder="Add a sub-goal and press Enter"
          aria-label="Add a sub-goal"
          value={subDraft}
          onChange={(e) => setSubDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !subDraft.trim()) return
            setSubs((s) => [...s, subDraft.trim()])
            setSubDraft('')
          }}
        />
      </div>
      <div className="suggestion-actions">
        <button
          className="btn btn-primary"
          disabled={!valid || atLimit || busy}
          title={atLimit ? LIMIT_NOTE : undefined}
          onClick={() =>
            onSave({
              title: title.trim(),
              details: details.trim(),
              sub_goals: subs.map((t) => t.trim()).filter(Boolean),
            })
          }
        >
          <CheckCircleIcon size={16} aria-hidden />
          Save goal
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {atLimit && <p className="note">{LIMIT_NOTE}</p>}
    </article>
  )
}
