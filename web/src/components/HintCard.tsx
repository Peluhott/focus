import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowClockwiseIcon, CheckIcon, FootprintsIcon, PlusIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { del, get, post } from '../lib/api'
import { errorMessage } from '../lib/optimistic'
import { useToast } from '../lib/toast'
import { todosKey } from '../lib/todos'
import type { Todo, TodoHintRun } from '../lib/types'

type State =
  | { phase: 'thinking' }
  | { phase: 'ready'; text: string }
  | { phase: 'added'; text: string; addedId: number }
  | { phase: 'error'; message: string }

const FAILED = "Couldn't think of a first step. Try again."

/**
 * "Help me start" (START-SMALL.md): one small first step for a to-do.
 * POST /todos/:id/hint starts a run; GET polls every second while it's
 * queued. Closing throws the state away; reopening asks again.
 */
export default function HintCard({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [state, setState] = useState<State>({ phase: 'thinking' })
  const [adding, setAdding] = useState(false)
  const lastForce = useRef(false)
  // Bumped on every request and on unmount, so a stale answer is ignored.
  const generation = useRef(0)

  const settle = useCallback((run: TodoHintRun) => {
    if (run.status === 'ready' && run.text) setState({ phase: 'ready', text: run.text })
    else setState({ phase: 'error', message: run.error ?? FAILED })
  }, [])

  const ask = useCallback(
    async (force: boolean) => {
      lastForce.current = force
      const gen = ++generation.current
      setState({ phase: 'thinking' })
      try {
        let { run } = await post<{ run: TodoHintRun }>(`/todos/${todo.id}/hint`, force ? { force: true } : {})
        while (run.status === 'queued') {
          await new Promise((r) => window.setTimeout(r, 1000))
          if (gen !== generation.current) return
          const latest = (await get<{ run: TodoHintRun | null }>(`/todos/${todo.id}/hint`)).run
          if (!latest) break
          run = latest
        }
        if (gen === generation.current) settle(run)
      } catch (error) {
        if (gen === generation.current) setState({ phase: 'error', message: errorMessage(error) })
      }
    },
    [todo.id, settle]
  )

  useEffect(() => {
    void ask(false)
    return () => {
      generation.current++
    }
  }, [ask])

  async function onAdd(text: string) {
    setAdding(true)
    try {
      const added = await post<Todo>(`/todos/${todo.id}/hint/add`, { title: text })
      // Show it right away: above the source (one-time), else on top.
      qc.setQueryData<Todo[]>(todosKey, (old) => {
        if (!old) return old
        const at = todo.recurring ? -1 : old.findIndex((t) => t.id === todo.id)
        const next = [...old]
        next.splice(at < 0 ? 0 : at, 0, added)
        return next
      })
      qc.invalidateQueries({ queryKey: todosKey })
      setState({ phase: 'added', text, addedId: added.id })
      toast('Added a to-do', () => {
        qc.setQueryData<Todo[]>(todosKey, (old) => old?.filter((t) => t.id !== added.id))
        setState((s) => (s.phase === 'added' && s.addedId === added.id ? { phase: 'ready', text } : s))
        del(`/todos/${added.id}`)
          .catch((error) => toast(errorMessage(error)))
          .finally(() => qc.invalidateQueries({ queryKey: todosKey }))
      })
    } catch (error) {
      toast(errorMessage(error))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="hint-card">
      <FootprintsIcon className="hint-card-icon" size={20} aria-hidden />
      <div className="hint-card-main">
        {state.phase === 'thinking' && (
          <p className="hint-thinking" role="status">
            Thinking of a first step…
          </p>
        )}
        {(state.phase === 'ready' || state.phase === 'added') && (
          <>
            <span className="hint-kicker">Start here</span>
            <p className="hint-text">{state.text}</p>
            <div className="hint-actions">
              {state.phase === 'ready' ? (
                <button className="btn btn-secondary hint-add" disabled={adding} onClick={() => onAdd(state.text)}>
                  <PlusIcon size={16} aria-hidden />
                  Add as to-do
                </button>
              ) : (
                <span className="hint-added">
                  <CheckIcon aria-hidden />
                  Added above this to-do.
                </span>
              )}
              <button className="btn btn-ghost hint-again" disabled={adding} onClick={() => ask(true)}>
                <ArrowClockwiseIcon size={16} aria-hidden />
                Another idea
              </button>
            </div>
          </>
        )}
        {state.phase === 'error' && (
          <div className="hint-error-row">
            <p className="hint-error" role="alert">
              <WarningCircleIcon size={18} aria-hidden />
              {state.message}
            </p>
            <button className="btn btn-ghost hint-retry" onClick={() => ask(lastForce.current)}>
              Try again
            </button>
          </div>
        )}
      </div>
      <button className="btn btn-ghost btn-icon hint-close" aria-label="Close" title="Close" onClick={onClose}>
        <XIcon size={16} aria-hidden />
      </button>
    </div>
  )
}
