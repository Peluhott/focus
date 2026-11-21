import { useState, type TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  /** Called on blur, only when the text changed. */
  onCommit: (value: string) => void
}

/** A markdown/notes textarea that keeps a local draft and saves on blur. */
export default function NotesField({ value, onCommit, className, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  return (
    <textarea
      {...rest}
      className={`input ${className ?? ''}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (draft !== value) onCommit(draft)
        onBlur?.(e)
      }}
    />
  )
}
