import { SignOutIcon } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useLogout, useMe } from '../lib/auth'
import { useSetAiEnabled, useSettings } from '../lib/settings'
import ApiKeys from '../components/ApiKeys'

/**
 * Settings (README §6): the AI toggle, API keys and Account. Export is
 * still to come.
 */
export default function Settings() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const setAi = useSetAiEnabled()
  const available = !!settings?.ai_available
  const on = available && !!settings?.ai_enabled

  return (
    <section data-screen-label="Settings">
      <h1 className="page-title">Settings</h1>
      <div style={{ display: 'grid', gap: 'var(--space-8)', maxWidth: 720, marginTop: 'var(--space-6)' }}>
        <section>
          <h3>AI alignment check</h3>
          <p style={{ maxWidth: '58ch', color: 'var(--color-neutral-800)' }}>
            Compares each open to-do with your active goals, and blurs the ones that don't serve
            any of them. When it's off, nothing is checked and no chips or highlights show.
          </p>
          <div className="seg" role="radiogroup" aria-label="AI alignment check">
            {[true, false].map((value) => (
              <label key={String(value)} className="seg-opt">
                <input
                  type="radio"
                  name="ai"
                  checked={settings ? on === value : false}
                  disabled={!available || !settings}
                  onChange={() => setAi.mutate({ enabled: value })}
                />
                {value ? 'On' : 'Off'}
              </label>
            ))}
          </div>
          {settings && !available && (
            <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-2)' }}>
              Not set up on the server. Set AI_ENABLED=true and GEMINI_API_KEY, then restart the
              API and worker.
            </p>
          )}
        </section>
        <ApiKeys />
        <section>
          <h3>Account</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span style={{ fontSize: 15 }}>{user?.email}</span>
            <button
              className="btn btn-secondary"
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
              disabled={logout.isPending}
            >
              <SignOutIcon size={16} aria-hidden />
              Sign out
            </button>
          </div>
        </section>
      </div>
    </section>
  )
}
