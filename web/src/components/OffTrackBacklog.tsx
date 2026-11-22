import { useState } from 'react'
import { CaretDownIcon, CaretRightIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import type { ConfirmRequest } from './ConfirmDialog'
import { useClearOffTrack, useOffTrack, useRemoveOffTrack } from '../lib/backlog'
import { shortDay } from '../lib/dates'

/**
 * "Off-track backlog (N)" (docs "Off-track backlog"): the red to-dos you
 * checked off. A record, not a second to-do list: remove one, or clear all.
 */
export default function OffTrackBacklog({ confirm }: { confirm: (request: ConfirmRequest) => void }) {
  const { data: items } = useOffTrack()
  const remove = useRemoveOffTrack()
  const clear = useClearOffTrack()
  const [open, setOpen] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <section className="backlog" aria-label="Off-track backlog">
      <div className="backlog-head">
        <button className="btn btn-ghost archived-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
          Off-track backlog ({items.length})
        </button>
        {open && (
          <button
            className="btn btn-ghost muted"
            onClick={() =>
              confirm({
                title: 'Clear the off-track backlog?',
                body: `All ${items.length} entries will be removed. They won't feed goal suggestions any more.`,
                action: 'Clear all',
                run: () => clear.mutate(),
              })
            }
          >
            Clear all
          </button>
        )}
      </div>
      {open && (
        <>
          <p className="hint backlog-hint">
            Red to-dos you checked off. Recurring themes here can turn into suggested goals.
          </p>
          <ul className="backlog-list">
            {items.map((item) => (
              <li key={item.id} className="backlog-row">
                <div className="backlog-text">
                  <span className="backlog-title">{item.title_snapshot}</span>
                  {item.reason && (
                    <span className="backlog-reason">
                      <WarningIcon aria-hidden />
                      {item.reason}
                    </span>
                  )}
                </div>
                <span className="backlog-date">Moved {shortDay(item.moved_at)}</span>
                <button
                  className="btn btn-ghost btn-icon tiny-icon muted"
                  aria-label={`Remove “${item.title_snapshot}” from the backlog`}
                  onClick={() => remove.mutate({ id: item.id })}
                >
                  <XIcon aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
