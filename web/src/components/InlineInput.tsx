import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  /** Called on blur or Enter, only when the text changed. */
  onCommit: (value: string) => void
  /** Called on every keystroke (e.g. for a debounced re-check). */
  onDraft?: (value: string) => void
  /** When false, clearing the text reverts it instead of saving "". */
  allowEmpty?: boolean
}

/**
 * Borderless, transparent text that edits in place. Keeps a local draft so
 * typing stays instant, and commits on blur or Enter. Esc reverts.
 */
export default function InlineInput({
  value,
  onCommit,
  onDraft,
  allowEmpty = true,
  className,
  onKeyDown,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = useState(value)
  // When the saved value changes underneath (server update, undo), take it.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }

  const commit = () => {
    if (!allowEmpty && !draft.trim()) {
      setDraft(value)
      return
    }
    if (draft !== value) onCommit(draft)
  }

  return (
    <input
      {...rest}
      className={`inline-input ${className ?? ''}`}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        onDraft?.(e.target.value)
      }}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setDraft(value)
          // Blur after the revert has rendered, so it doesn't commit the draft.
          const el = e.currentTarget
          requestAnimationFrame(() => el.blur())
        }
        onKeyDown?.(e)
      }}
    />
  )
}
