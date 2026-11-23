import { useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TargetIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { ApiError } from '../lib/api'
import { useLogin, useMe } from '../lib/auth'

function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  if (error.code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (error.code === 'rate_limited' || error.status === 429) {
    return 'Too many attempts. Try again in a minute.'
  }
  if (error.code === 'validation_error') return 'Enter your email and password.'
  return error.message
}

/**
 * Background distractions, out of focus around the wordmark (LOGIN.md).
 * Positions are percentages of the viewport; sizes scale with its width.
 */
const WORDS: { text: string; style: CSSProperties }[] = [
  { text: 'Reorganize bookmarks', style: { left: '5.6%', top: '10.5%', fontSize: 'max(20px, 2.65vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)', filter: 'blur(5px)' } },
  { text: 'Reply to Sam about dinner', style: { left: '36%', top: '6%', fontSize: 'max(15px, 1.72vw)', color: 'var(--color-neutral-600)' } },
  { text: 'Browse flights', style: { right: '7.5%', top: '13.75%', fontSize: 'max(24px, 3.1vw)', color: 'var(--color-neutral-500)', filter: 'blur(7px)' } },
  { text: 'Clean out the inbox', style: { left: '11.7%', top: '31%', fontSize: 'max(16px, 1.88vw)', color: 'var(--color-neutral-600)' } },
  { text: 'New video game?', style: { right: '9.4%', top: '36%', fontSize: 'max(17px, 2.03vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)', filter: 'blur(3.5px)' } },
  { text: 'Rearrange the desk', style: { left: '3.75%', top: '59%', fontSize: 'max(26px, 3.44vw)', color: 'var(--color-neutral-500)', filter: 'blur(8px)' } },
  { text: 'Watch that documentary', style: { right: '5%', top: '62.5%', fontSize: 'max(15px, 1.72vw)', color: 'var(--color-neutral-600)' } },
  { text: 'Sort old photos', style: { left: '11%', bottom: '10%', fontSize: 'max(17px, 2.03vw)', fontStyle: 'italic', color: 'var(--color-neutral-600)', filter: 'blur(1px)' } },
  { text: 'Price new headphones', style: { right: '14%', bottom: '7.5%', fontSize: 'max(20px, 2.5vw)', color: 'var(--color-neutral-500)', filter: 'blur(6px)' } },
]

/** Fixed illustrative copy: shown before sign-in, so never the user's real goals. */
const SAMPLE_GOALS = ['Ship Focus v1', 'Run a half marathon', 'Build an emergency fund']

/** Login, "Depth of field" (LOGIN.md): single account, sign-up closed. */
export default function Login() {
  const { data: user } = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/goals'
  if (user) return <Navigate to={from} replace />

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate(from, { replace: true }),
        // Keep the email; clear the password.
        onError: () => setPassword(''),
      }
    )
  }

  return (
    <main className="login" data-screen-label="Login">
      <div className="login-words" aria-hidden="true">
        {WORDS.map((w) => (
          <span key={w.text} className="login-word" style={w.style}>
            {w.text}
          </span>
        ))}
      </div>
      <div className="login-center">
        <h1 className="login-wordmark">Focus</h1>
        <div className="login-goals">
          {SAMPLE_GOALS.map((g) => (
            <span key={g} className="login-goal">
              <TargetIcon aria-hidden />
              {g}
            </span>
          ))}
        </div>
        <p className="login-tagline">A few goals at a time. Every project and to-do traces back to one.</p>
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <input
            className="input login-email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input login-password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn btn-primary login-submit" type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {login.isError && (
          <p className="login-error" role="alert">
            <WarningCircleIcon aria-hidden />
            {errorText(login.error)}
          </p>
        )}
      </div>
    </main>
  )
}
