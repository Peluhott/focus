import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BugIcon,
  ChatCircleIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  ImageIcon,
  LightbulbIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  XIcon,
} from '@phosphor-icons/react'
import { postForm } from '../lib/api'
import { useMe } from '../lib/auth'
import { closeOverlay, openFeedback, useOverlay } from '../lib/overlays'
import { useSettings } from '../lib/settings'

type Kind = 'idea' | 'bug' | 'other'

const TYPES: { value: Kind; label: string; Icon: typeof LightbulbIcon; placeholder: string }[] = [
  { value: 'idea', label: 'Idea', Icon: LightbulbIcon, placeholder: 'What would make Focus better for you?' },
  { value: 'bug', label: "Something's broken", Icon: BugIcon, placeholder: 'What happened, and what did you expect?' },
  { value: 'other', label: 'Other', Icon: ChatCircleIcon, placeholder: 'Anything on your mind.' },
]

const FEATURES = [
  'General',
  'Goals',
  'To-dos',
  'Projects',
  'Notes',
  'Calendar',
  'Timer',
  'Search',
  'Help me start',
  'Off-goal flags',
  'Settings',
] as const

/** The feature to preset from the page you're on. */
function featureFor(path: string): (typeof FEATURES)[number] {
  if (path.startsWith('/goals')) return 'Goals'
  if (path.startsWith('/todos')) return 'To-dos'
  if (path.startsWith('/projects')) return 'Projects'
  if (path.startsWith('/notes')) return 'Notes'
  if (path.startsWith('/calendar')) return 'Calendar'
  if (path.startsWith('/settings')) return 'Settings'
  return 'General'
}

/**
 * Send feedback (FEEDBACK.md): a corner button on every app page and a
 * modal form. Saved by POST /feedback (the server notes the workspace from
 * the header); a screenshot rides along for bugs when file storage is set up.
 */
export default function Feedback() {
  const overlay = useOverlay()
  const open = overlay === 'feedback'
  return (
    <>
      {!open && (
        <button type="button" className="btn btn-secondary feedback-corner" onClick={openFeedback}>
          <ChatCircleTextIcon size={18} aria-hidden />
          Feedback
        </button>
      )}
      {open && <FeedbackForm />}
    </>
  )
}

function FeedbackForm() {
  const location = useLocation()
  const { data: user } = useMe()
  const { data: settings } = useSettings()
  const [kind, setKind] = useState<Kind>('idea')
  const [feature, setFeature] = useState<(typeof FEATURES)[number]>(() => featureFor(location.pathname))
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState(true)
  const [shot, setShot] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (sent) closeRef.current?.focus()
  }, [sent])

  const type = TYPES.find((t) => t.value === kind)!
  const email = user?.email ?? ''
  const name = user?.display_name?.trim() || email.split('@')[0] || 'there'

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setFailed(false)
    const form = new FormData()
    form.append('type', kind)
    form.append('feature', feature)
    form.append('message', message.trim())
    form.append('contact_ok', String(contact))
    form.append('page', location.pathname)
    form.append('app_version', __APP_VERSION__)
    form.append('user_agent', navigator.userAgent)
    if (kind === 'bug' && shot) form.append('screenshot', shot)
    try {
      await postForm('/feedback', form)
      setSent(true)
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="overlay-backdrop" onClick={closeOverlay} />
      <div className="overlay-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        {sent ? (
          <div className="feedback-sent">
            <CheckCircleIcon size={36} className="feedback-sent-icon" aria-hidden />
            <h3 id="feedback-title">Thanks, {name}.</h3>
            <p className="feedback-sub-plain">
              Your note about {feature} was sent.
              {contact && email ? ` If there are questions, a reply will come to ${email}.` : ''}
            </p>
            <div className="feedback-actions">
              <button ref={closeRef} type="button" className="btn btn-secondary" onClick={closeOverlay}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={send}>
            <div className="feedback-head">
              <div>
                <h3 id="feedback-title">Send feedback</h3>
                <p className="feedback-sub">Ideas, bugs, or anything else.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={closeOverlay}>
                <XIcon size={18} aria-hidden />
              </button>
            </div>

            <div className="seg feedback-types" role="radiogroup" aria-label="Type">
              {TYPES.map(({ value, label, Icon }) => (
                <label key={value} className="seg-opt">
                  <input type="radio" name="feedback-type" checked={kind === value} onChange={() => setKind(value)} />
                  <Icon size={16} aria-hidden />
                  {label}
                </label>
              ))}
            </div>

            <div className="field">
              <label htmlFor="feedback-feature">Feature</label>
              <select
                id="feedback-feature"
                className="input"
                value={feature}
                onChange={(e) => setFeature(e.target.value as (typeof FEATURES)[number])}
              >
                {FEATURES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-message">Message</label>
              <textarea
                id="feedback-message"
                className="input feedback-message"
                rows={4}
                autoFocus
                maxLength={5000}
                placeholder={type.placeholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {kind === 'bug' && settings?.storage_enabled && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    setShot(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
                {shot ? (
                  <div className="feedback-shot">
                    <ImageIcon size={18} aria-hidden />
                    <span className="feedback-shot-name">{shot.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label="Remove screenshot"
                      onClick={() => setShot(null)}
                    >
                      <XIcon size={16} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                    <PaperclipIcon size={16} aria-hidden />
                    Attach a screenshot
                  </button>
                )}
              </div>
            )}

            {email && (
              <label className="feedback-contact">
                <input
                  type="checkbox"
                  className="check check-16"
                  checked={contact}
                  onChange={(e) => setContact(e.target.checked)}
                />
                OK to email me about this at {email}
              </label>
            )}

            {failed && <p className="feedback-error">Couldn't send. Try again.</p>}
            <div className="feedback-actions">
              <button type="button" className="btn btn-ghost" onClick={closeOverlay}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!message.trim() || sending}>
                <PaperPlaneTiltIcon size={16} aria-hidden />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
