import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useLogin, useMe } from '../lib/auth'

function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  if (error.code === 'invalid_credentials') return 'Wrong email or password.'
  if (error.code === 'rate_limited') return error.message
  if (error.code === 'validation_error') return 'Enter your email and password.'
  return error.message
}

/** Login (README §1): single account, sign-up closed. */
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
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <main className="login" data-screen-label="Login">
      <div>
        <h1 className="login-wordmark">
          <span className="cmyk-head">
            <span className="paper">Focus</span>
            <span className="plate plate-c" aria-hidden="true">
              Focus
            </span>
            <span className="plate plate-m" aria-hidden="true">
              Focus
            </span>
            <span className="plate plate-y" aria-hidden="true">
              Focus
            </span>
          </span>
        </h1>
        <p className="login-tagline">
          A few goals at a time. Every project and to-do traces back to one.
        </p>
      </div>
      <form className="login-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            className="input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          type="submit"
          style={{ minHeight: 40 }}
          disabled={login.isPending}
        >
          Sign in
        </button>
        {login.isError && (
          <p className="form-error" role="alert">
            {errorText(login.error)}
          </p>
        )}
        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Single account. Sign-up is closed.
        </p>
      </form>
    </main>
  )
}
