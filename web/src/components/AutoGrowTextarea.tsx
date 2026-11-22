import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  /** Called on blur or Enter, only when the text changed. */
  onCommit: (value: string) => void
  /** When false, clearing the text reverts it instead of saving "". */
  allowEmpty?: boolean
}

/**
 * Borderless title text that wraps and grows with its content (goal and
 * sub-goal titles). Same editing rules as InlineInput: a local draft, commit
 * on blur or Enter (Enter never adds a newline), Esc reverts.
 */
export default function AutoGrowTextarea({
  value,
  onCommit,
  allowEmpty = true,
  className,
  onKeyDown,
  onBlur,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }

  // Fallback for browsers without `field-sizing: content`.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  const commit = () => {
    if (!allowEmpty && !draft.trim()) {
      setDraft(value)
      return
    }
    if (draft !== value) onCommit(draft)
  }

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      className={`autogrow ${className ?? ''}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setDraft(value)
          const el = e.currentTarget
          requestAnimationFrame(() => el.blur())
        }
        onKeyDown?.(e)
      }}
    />
  )
}
