import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  CircleIcon,
  FootprintsIcon,
  LinkSimpleIcon,
  PlusIcon,
  TargetIcon,
  WarningCircleIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import Landing from '../components/Landing'
import { ApiError } from '../lib/api'
import { useLogin, useMe, useSignup } from '../lib/auth'

type Mode = 'login' | 'signup'

/** Matches the API (PATCH /account and POST /auth/signup). */
const MIN_PASSWORD = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorText(error: unknown, mode: Mode): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  if (error.code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (error.code === 'rate_limited' || error.status === 429) {
    return 'Too many attempts. Try again in a minute.'
  }
  if (error.code === 'validation_error') {
    return mode === 'login' ? 'Enter your email and password.' : error.message
  }
  return error.message
}

/**
 * Login and sign-up: the landing page (design_handoff_focus_landing, with
 * the "depth of field" splash as its hero), then a split auth panel
 * (LOGIN-SIGNUP.md). Email only: no
 * single sign-on, and "Forgot it?" stays hidden until there's a reset flow.
 */
export default function Login() {
  const { data: user } = useMe()
  const location = useLocation()
  const [mode, setMode] = useState<Mode | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/goals'
  if (user) return <Navigate to={from} replace />

  if (mode) return <AuthPanel mode={mode} setMode={setMode} from={from} />

  return (
    <Landing
      onAuth={(m) => {
        setMode(m)
        window.scrollTo(0, 0)
      }}
    />
  )
}

function AuthPanel({ mode, setMode, from }: { mode: Mode; setMode: (m: Mode | null) => void; from: string }) {
  const login = useLogin()
  const signup = useSignup()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<{ text: string; emailTaken?: boolean } | null>(null)
  const busy = login.isPending || signup.isPending
  const isSignup = mode === 'signup'

  function switchMode(next: Mode) {
    setMode(next)
    setProblem(null)
  }

  function back() {
    setPassword('')
    setMode(null)
  }

  const done = () => {
    setPassword('')
    window.scrollTo(0, 0)
    navigate(from, { replace: true })
  }

  const failed = (error: unknown) => {
    setPassword('')
    if (error instanceof ApiError && error.code === 'email_taken') {
      setProblem({ text: 'That email already has an account.', emailTaken: true })
    } else {
      setProblem({ text: errorText(error, mode) })
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setProblem(null)
    if (isSignup) {
      if (!name.trim()) return setProblem({ text: 'Enter your name.' })
      if (!EMAIL.test(email.trim())) return setProblem({ text: 'Enter a valid email address.' })
      if (password.length < MIN_PASSWORD) {
        return setProblem({ text: `Passwords are at least ${MIN_PASSWORD} characters.` })
      }
      signup.mutate(
        { name: name.trim(), email: email.trim(), password },
        { onSuccess: done, onError: failed }
      )
    } else {
      if (!email.trim() || !password) return setProblem({ text: 'Enter your email and password.' })
      login.mutate({ email: email.trim(), password }, { onSuccess: done, onError: failed })
    }
  }

  return (
    <main className="auth" data-screen-label="Login panel">
      <div className="auth-col">
        <div className="auth-head">
          <span className="auth-wordmark">Focus</span>
          <button type="button" className="btn btn-ghost auth-back" onClick={back}>
            <ArrowLeftIcon size={16} aria-hidden />
            Back
          </button>
        </div>
        <div className="auth-form-block">
          <div className="auth-heading">
            <h1>{isSignup ? 'Make an account' : 'Welcome back'}</h1>
            <p>{isSignup ? 'Start with one goal. Add the rest when you need them.' : 'Pick up where you left off.'}</p>
          </div>
          <div className="seg auth-seg" role="radiogroup" aria-label="Log in or sign up">
            {(['login', 'signup'] as const).map((m) => (
              <label key={m} className="seg-opt">
                <input type="radio" name="auth-mode" checked={mode === m} onChange={() => switchMode(m)} />
                {m === 'login' ? 'Log in' : 'Sign up'}
              </label>
            ))}
          </div>
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            {isSignup && (
              <div className="field">
                <label htmlFor="auth-name">Name</label>
                <input
                  id="auth-name"
                  className="input"
                  autoComplete="name"
                  placeholder="What should we call you?"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="input"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {isSignup && <span className="auth-hint">At least {MIN_PASSWORD} characters.</span>}
            </div>
            {problem && (
              <p className="auth-error" role="alert">
                <WarningCircleIcon size={18} aria-hidden />
                <span>
                  {problem.text}
                  {problem.emailTaken && (
                    <>
                      {' '}
                      <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                        Log in
                      </button>{' '}
                      instead?
                    </>
                  )}
                </span>
              </p>
            )}
            <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={busy}>
              {isSignup ? (busy ? 'Creating account…' : 'Create account') : busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <p className="auth-switch">
            {isSignup ? 'Already have an account? ' : 'New to Focus? '}
            <button type="button" className="auth-link" onClick={() => switchMode(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
      <FeatureOverview />
    </main>
  )
}

/** Static, decorative previews: never real data. */
function FeatureOverview() {
  return (
    <aside className="auth-aside" data-screen-label="Feature overview">
      <div className="auth-intro">
        <h6>What's inside</h6>
        <h2>A few goals at a time. Every project and to-do traces back to one.</h2>
      </div>
      <div className="auth-feature">
        <div className="auth-feature-text">
          <LinkSimpleIcon size={28} aria-hidden />
          <h4>Every to-do checked</h4>
          <p>
            Each new to-do is matched to the goal or project it serves. Anything that doesn't fit gets flagged, so you
            can relink it or let it go.
          </p>
        </div>
        <div className="card elev-sm auth-preview" aria-hidden="true">
          <span className="auth-preview-label">To-dos</span>
          <div className="auth-preview-row">
            <CircleIcon size={20} />
            <span className="auth-preview-title">Easy 5 km run</span>
            <span className="tag tag-accent">
              <TargetIcon />
              Run a half marathon
            </span>
          </div>
          <div className="auth-preview-row">
            <CircleIcon size={20} />
            <span className="auth-preview-title">Transfer $20 to savings</span>
            <span className="tag tag-accent">
              <TargetIcon />
              Build an emergency fund
            </span>
          </div>
          <div>
            <div className="auth-preview-row">
              <CircleIcon size={20} />
              <span className="auth-preview-title">Research a new video game to play</span>
            </div>
            <span className="auth-preview-flag">
              <WarningIcon size={16} />
              Doesn't relate to any active goal.
            </span>
          </div>
        </div>
      </div>
      <div className="auth-feature">
        <div className="auth-feature-text">
          <FootprintsIcon size={28} aria-hidden />
          <h4>Help me start</h4>
          <p>Stuck on a to-do? Get a small first step you can add to the list.</p>
        </div>
        <div className="card elev-sm auth-preview" aria-hidden="true">
          <div className="auth-preview-row">
            <CircleIcon size={20} />
            <span className="auth-preview-title">Plan the Japan trip</span>
            <span className="auth-preview-hintbtn">
              <FootprintsIcon size={18} />
            </span>
          </div>
          <div className="auth-preview-panel">
            <FootprintsIcon size={20} className="auth-preview-panel-icon" />
            <div className="auth-preview-panel-main">
              <span className="hint-kicker">Start here</span>
              <span className="auth-preview-step">Open a note and list three cities you want to see.</span>
              <div className="hint-actions">
                <span className="btn btn-secondary hint-add">
                  <PlusIcon size={16} />
                  Add as to-do
                </span>
                <span className="btn btn-ghost hint-again">
                  <ArrowsClockwiseIcon size={16} />
                  Another idea
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
