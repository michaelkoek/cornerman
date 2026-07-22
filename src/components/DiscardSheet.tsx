import { useState } from 'react'
import type { Session } from '../../shared/types'
import { api } from '../lib/api'
import { sportClass } from '../lib/format'
import { Sheet } from './Sheet'

interface IDiscardSheetProps {
  open: boolean
  session: Session
  onClose: () => void
  onDiscarded: () => void
}

/** Confirm-and-delete for a session: discard an active workout or delete a logged one. */
export function DiscardSheet({ open, session, onClose, onDiscarded }: IDiscardSheetProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loggedSets = session.exercises.reduce(
    (n, se) => n + se.sets.filter((s) => s.done).length,
    0,
  )

  const isLogged = session.status === 'done'
  const title = isLogged ? 'Delete session' : 'Discard workout'
  const confirmLabel = isLogged ? 'Delete session' : 'Discard workout'
  const busyLabel = isLogged ? 'Deleting…' : 'Discarding…'
  const cancelLabel = isLogged ? 'Keep it' : 'Keep going'

  const body =
    isLogged
      ? 'This permanently removes the session from your history and stats. It won’t count toward your week.'
      : loggedSets > 0
        ? `This throws away today’s workout and the ${loggedSets} set${loggedSets === 1 ? '' : 's'} you logged. You’ll be back to picking your time.`
        : 'This throws away today’s workout so you can pick a fresh one. Nothing’s been logged yet.'

  const discard = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteSession(session.id)
      onClose()
      onDiscarded()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isLogged ? 'delete' : 'discard'} the session.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title} sportClass={sportClass(session.sport)}>
      <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        {body}
      </p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button"
        className="btn btn--danger form-submit"
        disabled={busy}
        onClick={() => void discard()}
      >
        {busy ? busyLabel : confirmLabel}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: '100%', marginTop: 'var(--space-2)' }}
        disabled={busy}
        onClick={onClose}
      >
        {cancelLabel}
      </button>
    </Sheet>
  )
}
