import { useState } from 'react'
import { XIcon } from '@phosphor-icons/react'
import { aiLimitMessage, useAiOn, useSettings } from '../lib/settings'

const dismissKey = (kind: string, resets: string | null) => `focus:ai-limit-dismissed:${kind}:${resets ?? ''}`

function wasDismissed(key: string) {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/**
 * A slim notice under the header while a monthly AI spend cap has paused
 * AI in this workspace (only when AI is on here). Dismissed per tab session
 * and per cap, so a new month or a different cap shows it again.
 */
export default function AiLimitNotice() {
  const { data: settings } = useSettings()
  const aiOn = useAiOn()
  const message = aiLimitMessage(settings)
  const key = dismissKey(settings?.ai_limit ?? '', settings?.ai_limit_resets_at ?? null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  if (!aiOn || !message || dismissed === key || wasDismissed(key)) return null

  function dismiss() {
    try {
      sessionStorage.setItem(key, '1')
    } catch {
      // Private mode: it still hides until the next reload.
    }
    setDismissed(key)
  }

  return (
    <div className="ai-limit-notice" role="status">
      <p>{message}</p>
      <button type="button" className="btn btn-ghost ai-limit-dismiss" aria-label="Dismiss" onClick={dismiss}>
        <XIcon aria-hidden />
      </button>
    </div>
  )
}
