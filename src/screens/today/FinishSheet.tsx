import { useState } from 'react'
import type { Session } from '../../../shared/types'
import { api } from '../../lib/api'
import { fmtRunTime, sportClass } from '../../lib/format'
import { useElapsedTimer } from '../../lib/useElapsedTimer'
import { finishTimerPatch } from '../../lib/workoutTimer'
import { RpeSlider } from '../../components/RpeSlider'
import { Sheet } from '../../components/Sheet'

interface IFinishSheetProps {
  open: boolean
  session: Session
  prCount?: number
  onClose: () => void
  onFinished: () => void
}

export function FinishSheet({ open, session, prCount = 0, onClose, onFinished }: IFinishSheetProps) {
  const [rpe, setRpe] = useState(session.rpe ?? 7)
  const [note, setNote] = useState(session.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const elapsed = useElapsedTimer(session.startedAt, session.elapsedSec)

  const finish = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await api.updateSession(session.id, {
        ...finishTimerPatch(session, Date.now()),
        status: 'done',
        rpe,
        note: note.trim() || undefined,
      })
      onClose()
      onFinished()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not finish the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Finish session" sportClass={sportClass(session.sport)}>
      {prCount > 0 && (
        <p className="coach-line finish-prs">
          {prCount === 1 ? '1 personal record today' : `${prCount} personal records today`} — that’s
          how you get stronger.
        </p>
      )}
      {elapsed > 0 && (
        <p className="finish-time">
          <span className="type-eyebrow">Time</span>
          <span className="type-data-m finish-time__value">{fmtRunTime(elapsed)}</span>
        </p>
      )}
      <div className="field">
        <span className="type-eyebrow">How hard was it?</span>
        <RpeSlider value={rpe} onChange={setRpe} />
      </div>
      <div className="field">
        <label className="type-eyebrow" htmlFor="finish-note">
          Note
        </label>
        <textarea
          id="finish-note"
          className="input"
          placeholder="PRs, pain points, what to hit next time…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
      <button
        type="button"
        className="btn btn--primary form-submit"
        disabled={saving}
        onClick={() => void finish()}
      >
        {saving ? 'Saving…' : 'Save session'}
      </button>
    </Sheet>
  )
}
