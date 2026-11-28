import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChatCircleTextIcon, GearSixIcon, SignOutIcon } from '@phosphor-icons/react'
import { useLogout, useMe } from '../lib/auth'
import { openFeedback } from '../lib/overlays'

/**
 * The avatar at the end of the header (V2-UI-CHANGES §3): Settings, Send
 * feedback and Sign out. Picking an item, navigating, Esc or a click
 * outside closes it.
 */
export default function AccountMenu() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = (user?.display_name?.trim() || user?.email || '?').charAt(0).toUpperCase()
  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="account" ref={root}>
      <button
        ref={button}
        type="button"
        className="account-avatar"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {initial}
      </button>
      {open && (
        <div className="menu account-menu" role="menu" aria-label="Account">
          {user?.email && <div className="account-email">{user.email}</div>}
          <button type="button" role="menuitem" className="menu-item" onClick={pick(() => navigate('/settings'))}>
            <GearSixIcon aria-hidden />
            Settings
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={pick(openFeedback)}>
            <ChatCircleTextIcon aria-hidden />
            Send feedback
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={pick(() => logout.mutate())}>
            <SignOutIcon aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
