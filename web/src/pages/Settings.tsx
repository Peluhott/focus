import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckIcon,
  DownloadSimpleIcon,
  PlusIcon,
  SignOutIcon,
  TrashIcon,
  WarningCircleIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import ApiKeys from '../components/ApiKeys'
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog'
import InlineInput from '../components/InlineInput'
import SortableList from '../components/SortableList'
import { useLogout, useMe, useUpdateAccount, type AccountPatch, type User } from '../lib/auth'
import { errorMessage } from '../lib/optimistic'
import { useSetAiEnabled, useSetTimerMinutes, useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'
import { useWorkspace } from '../lib/workspace'
import {
  useCreateWorkspace,
  useCurrentWorkspaceInfo,
  useMoveWorkspace,
  useRenameWorkspace,
  useWorkspaces,
} from '../lib/workspaces'

/** Settings (SETTINGS.md): Account, Workspaces, AI alignment check, Timer, API keys, Data. */
export default function Settings() {
  const { data: user } = useMe()
  return (
    <section data-screen-label="Settings">
      <h1 className="page-title">Settings</h1>
      <div className="settings">
        {user && <AccountSection user={user} />}
        <WorkspacesSection />
        <AiSection />
        <TimerSection />
        <ApiKeys />
        <section>
          <h3>Data</h3>
          <p className="settings-copy">Download goals, projects, to-dos and notes from every workspace as JSON.</p>
          {/* The API sends it as an attachment; the session cookie rides along. */}
          <a className="btn btn-secondary" href="/api/v1/export" download>
            <DownloadSimpleIcon size={16} aria-hidden />
            Export all
          </a>
        </section>
      </div>
    </section>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function AccountSection({ user }: { user: User }) {
  const update = useUpdateAccount()
  const logout = useLogout()
  const navigate = useNavigate()
  const [name, setName] = useState(user.display_name ?? '')
  const [email, setEmail] = useState(user.email)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const timer = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(timer)
  }, [saved])

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()
  const nameChanged = name.trim() !== (user.display_name ?? '')
  const dirty = nameChanged || emailChanged || next !== ''

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v)
    setError(null)
    setSaved(false)
  }

  function validate(): string | null {
    if (!name.trim()) return "Display name can't be empty."
    if (!EMAIL.test(email.trim())) return 'Enter a valid email address.'
    if ((emailChanged || next) && !current) return 'Enter your current password to change your email or password.'
    if (next && next.length < 8) return 'New password must be at least 8 characters.'
    return null
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const body: AccountPatch = {}
    if (nameChanged) body.display_name = name.trim()
    if (emailChanged) body.email = email.trim()
    if (next) body.new_password = next
    if (emailChanged || next) body.current_password = current
    update.mutate(body, {
      onSuccess: ({ user: saved }) => {
        setName(saved.display_name ?? '')
        setEmail(saved.email)
        setCurrent('')
        setNext('')
        setSaved(true)
      },
      onError: (err) => setError(errorMessage(err)),
    })
  }

  return (
    <section>
      <h3>Account</h3>
      <form className="settings-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="acct-name">Display name</label>
          <input
            id="acct-name"
            className="input"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => edit(setName)(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="acct-email">Email</label>
          <input
            id="acct-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => edit(setEmail)(e.target.value)}
          />
        </div>
        <div className="settings-pair">
          <div className="field">
            <label htmlFor="acct-current">Current password</label>
            <input
              id="acct-current"
              className="input"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => edit(setCurrent)(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="acct-new">New password</label>
            <input
              id="acct-new"
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep"
              value={next}
              onChange={(e) => edit(setNext)(e.target.value)}
            />
          </div>
        </div>
        <p className="settings-help">
          Changing your email or password needs your current password. New passwords are at least 8 characters.
        </p>
        {error && (
          <p className="settings-error" role="alert">
            <WarningCircleIcon size={18} aria-hidden />
            {error}
          </p>
        )}
        <div className="settings-actions">
          <button className="btn btn-primary" type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="settings-saved" role="status">
              <CheckIcon aria-hidden />
              Saved
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost push-right"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
            disabled={logout.isPending}
          >
            <SignOutIcon size={16} aria-hidden />
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </form>
    </section>
  )
}

/**
 * Workspaces: any number, Personal and Work to start. Rename in place, drag
 * to reorder, add at the bottom. Deleting asks first (it takes everything
 * in the workspace, with no Undo); the last one can't be deleted.
 */
function WorkspacesSection() {
  const { data: list = [] } = useWorkspaces()
  const { workspace, remove } = useWorkspace()
  const create = useCreateWorkspace()
  const rename = useRenameWorkspace()
  const move = useMoveWorkspace()
  const toast = useToast()
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const only = list.length <= 1

  function add(e: FormEvent) {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    create.mutate(value, {
      onSuccess: () => setName(''),
      onError: (error) => toast(errorMessage(error)),
    })
  }

  function askDelete(id: number, label: string) {
    setConfirm({
      title: `Delete ${label}?`,
      body: `Its goals, projects, to-dos, notes and files are deleted for good. This can't be undone.`,
      action: `Delete ${label}`,
      run: () => {
        remove(id).catch((error) => toast(errorMessage(error)))
      },
    })
  }

  return (
    <section>
      <h3>Workspaces</h3>
      <p className="settings-copy">
        Each workspace has its own goals, projects, to-dos, notes and AI setting. Nothing is shared between them.
      </p>
      <SortableList
        items={list}
        noun="workspace"
        className="ws-list"
        itemClassName={() => 'ws-row'}
        onMove={(id, _placement, order) => move.mutate({ id, ids: order.map((w) => w.id) })}
        renderItem={(ws, handle) => (
          <>
            {handle}
            <InlineInput
              value={ws.name}
              aria-label="Workspace name"
              className="ws-name"
              maxLength={40}
              allowEmpty={false}
              onCommit={(value) =>
                rename.mutate(
                  { id: ws.id, name: value.trim() },
                  { onError: (error) => toast(errorMessage(error)) }
                )
              }
            />
            {ws.id === workspace && <span className="tag tag-neutral">Open</span>}
            <button
              className="btn btn-ghost btn-icon muted"
              aria-label={`Delete ${ws.name}`}
              title={only ? 'You need at least one workspace.' : `Delete ${ws.name}`}
              disabled={only}
              onClick={() => askDelete(ws.id, ws.name)}
            >
              <TrashIcon size={16} aria-hidden />
            </button>
          </>
        )}
      />
      <form className="ws-add" onSubmit={add}>
        <input
          className="input"
          placeholder="New workspace"
          aria-label="New workspace name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-secondary" type="submit" disabled={!name.trim() || create.isPending}>
          <PlusIcon size={16} aria-hidden />
          Add workspace
        </button>
      </form>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </section>
  )
}

/**
 * AI per workspace (WORK-MODE.md). Where the workspace asks for it (every
 * one but the original Personal), On first shows the warning; the setting
 * only changes on "I understand", every time.
 */
function AiSection() {
  const { data: settings } = useSettings()
  const setAi = useSetAiEnabled()
  const info = useCurrentWorkspaceInfo()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const available = !!settings?.ai_available
  const on = available && !!settings?.ai_enabled
  const warn = !!settings?.ai_ack_required
  const name = info?.name ?? settings?.workspace.name ?? 'this workspace'

  function choose(value: boolean) {
    if (value === on) return
    if (value && warn) {
      setConfirm({
        title: `Turn on AI for ${name}?`,
        body: `Your to-dos, goals, projects and sub-goals in ${name} will be sent to an AI service to check alignment and suggest first steps. Don't enter confidential, proprietary, client or personal data, or anything your employer doesn't allow in outside tools. You're responsible for what you add; Focus isn't responsible for work information you choose to share.`,
        action: 'I understand, turn on AI',
        run: () => setAi.mutate({ enabled: true, acknowledged: true }),
      })
      return
    }
    setAi.mutate({ enabled: value })
  }

  return (
    <section>
      <h3 className="settings-h3-tag">
        AI alignment check
        <span className="tag tag-neutral">{name}</span>
      </h3>
      <p className="settings-copy">
        Compares each open to-do with your active goals, and blurs the ones that don't serve any of them. When it's
        off, nothing is checked and no chips or highlights show.
      </p>
      {warn && (
        <p className="settings-copy">
          Each workspace has its own setting. AI is off by default in new workspaces, so nothing from {name} leaves
          Focus unless you turn it on.
        </p>
      )}
      {warn && on && (
        <p className="settings-warning" role="note">
          <WarningIcon size={18} aria-hidden />
          AI is on for {name}. Keep confidential, client and other sensitive work information out of Focus.
        </p>
      )}
      <div className="seg" role="radiogroup" aria-label="AI alignment check">
        {[true, false].map((value) => (
          <label key={String(value)} className="seg-opt">
            <input
              type="radio"
              name="ai"
              checked={settings ? on === value : false}
              disabled={!available || !settings}
              onChange={() => choose(value)}
            />
            {value ? 'On' : 'Off'}
          </label>
        ))}
      </div>
      {settings && !available && (
        <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-2)' }}>
          Not set up on the server. Set AI_ENABLED=true and GEMINI_API_KEY, then restart the API and worker.
        </p>
      )}
      {/* Cancel leaves the radio on Off: the setting never changed. */}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </section>
  )
}

function TimerSection() {
  const { data: settings } = useSettings()
  const setMinutes = useSetTimerMinutes()
  const saved = settings?.timer_minutes
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? (saved === undefined ? '' : String(saved))

  function commit() {
    if (draft === null) return
    setDraft(null)
    const n = Number(draft)
    // Empty or invalid reverts; otherwise clamp to 1–180.
    if (!draft.trim() || !Number.isFinite(n)) return
    const minutes = Math.min(180, Math.max(1, Math.round(n)))
    if (minutes !== saved) setMinutes.mutate({ minutes })
  }

  return (
    <section>
      <h3>Timer</h3>
      <p className="settings-copy">
        The timer in the nav bar starts from this length. When it ends, you can run it again or pick a different
        length for that run.
      </p>
      <div className="field" style={{ maxWidth: 220 }}>
        <label htmlFor="timer-minutes">Default length (minutes)</label>
        <input
          id="timer-minutes"
          className="input"
          type="number"
          min={1}
          max={180}
          step={1}
          style={{ width: 120 }}
          disabled={!settings}
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
    </section>
  )
}
