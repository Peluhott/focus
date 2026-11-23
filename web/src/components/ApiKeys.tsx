import { useState, type FormEvent } from 'react'
import { CopyIcon, KeyIcon } from '@phosphor-icons/react'
import { ApiError } from '../lib/api'
import { API_SCOPES, useApiKeys, useCreateApiKey, useRevokeApiKey } from '../lib/keys'
import type { ApiKey } from '../lib/types'

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null

function keyState(k: ApiKey) {
  if (k.revoked_at) return `Revoked ${shortDate(k.revoked_at)}`
  if (k.expires_at && new Date(k.expires_at) < new Date()) return `Expired ${shortDate(k.expires_at)}`
  const used = k.last_used_at ? `Last used ${shortDate(k.last_used_at)}` : 'Never used'
  return k.expires_at ? `${used} · expires ${shortDate(k.expires_at)}` : used
}

/**
 * Settings > API keys: create a key with a name, scopes and an optional
 * expiry; the full key is shown once. Revoking takes effect at once.
 */
export default function ApiKeys() {
  const { data } = useApiKeys()
  const create = useCreateApiKey()
  const revoke = useRevokeApiKey()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['projects:read', 'projects:write'])
  const [expiresOn, setExpiresOn] = useState('')
  const [created, setCreated] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  const error = create.error instanceof ApiError ? create.error.message : create.error ? 'Something went wrong.' : null

  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      { name: name.trim(), scopes, expires_on: expiresOn || null },
      {
        onSuccess: (key) => {
          setCreated(key)
          setCopied(false)
          setName('')
          setExpiresOn('')
        },
      }
    )
  }

  function toggle(scope: string) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]))
  }

  async function copy() {
    if (!created?.key) return
    await navigator.clipboard.writeText(created.key)
    setCopied(true)
  }

  return (
    <section>
      <h3>API keys</h3>
      <p style={{ maxWidth: '58ch', color: 'var(--color-neutral-800)' }}>
        Let scripts and assistants use Focus with <code>Authorization: Bearer fk_…</code>. A key
        can only do what its scopes allow, and can't change settings or manage keys.
      </p>

      {created?.key && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }} role="status">
          <span className="card-kicker">New key: {created.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{created.key}</code>
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <CopyIcon size={16} aria-hidden />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="card-body">Copy it now. You won't see this key again.</p>
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: 480 }}>
        <div className="field">
          <label htmlFor="key-name">Name</label>
          <input
            id="key-name"
            className="input"
            value={name}
            maxLength={100}
            placeholder="e.g. Claude"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label" style={{ marginBottom: 5 }}>
            Scopes
          </legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '6px 24px' }}>
            {API_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2" style={{ fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggle(scope)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                {scope}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="key-expiry">Expires (optional)</label>
          <input
            id="key-expiry"
            type="date"
            className="input"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--color-danger, #b3261e)' }}>
            {error}
          </p>
        )}
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || scopes.length === 0 || create.isPending}
          >
            <KeyIcon size={16} aria-hidden />
            Create key
          </button>
        </div>
      </form>

      {data && data.data.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-6) 0 0', display: 'grid', gap: 'var(--space-3)' }}>
          {data.data.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center gap-3"
              style={{ opacity: k.revoked_at ? 0.6 : 1, borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15 }}>
                  {k.name} <code className="muted" style={{ fontSize: 12 }}>{k.prefix}…</code>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {k.scopes.join(', ')} · {keyState(k)}
                </div>
              </div>
              {!k.revoked_at && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={revoke.isPending && revoke.variables === k.id}
                  onClick={() => {
                    if (confirm(`Revoke "${k.name}"? Anything using it stops working right away.`)) {
                      revoke.mutate(k.id)
                    }
                  }}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
