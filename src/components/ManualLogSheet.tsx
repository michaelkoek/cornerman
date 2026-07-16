import { useEffect, useState } from 'react'
import type { Session, Sport } from '../../shared/types'
import { api } from '../lib/api'
import { SPORTS, SPORT_LABEL, sportClass, todayIso } from '../lib/format'
import { RpeSlider } from './RpeSlider'
import { Sheet } from './Sheet'
import { SportIcon } from './icons'

interface ManualLogSheetProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  defaultSport?: Sport
  /** When set, the sheet edits this existing session instead of creating one. */
  session?: Session | null
}

const BASE_DURATIONS = [30, 45, 60, 90]

function durationOptions(current: number): number[] {
  if (BASE_DURATIONS.includes(current)) {
    return BASE_DURATIONS
  }
  return [...BASE_DURATIONS, current].sort((a, b) => a - b)
}

/** Manual session form: sport, date, duration, RPE, note. Creates or edits. */
export function ManualLogSheet({ open, onClose, onSaved, defaultSport, session }: ManualLogSheetProps) {
  const editing = session != null
  const [sport, setSport] = useState<Sport>(defaultSport ?? 'kickboxing')
  const [date, setDate] = useState(todayIso())
  const [duration, setDuration] = useState(60)
  const [rpe, setRpe] = useState(6)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    setError(null)
    if (session) {
      setSport(session.sport)
      setDate(session.date)
      setDuration(session.durationMin ?? 60)
      setRpe(session.rpe ?? 6)
      setNote(session.note ?? '')
    } else {
      setSport(defaultSport ?? 'kickboxing')
      setDate(todayIso())
      setDuration(60)
      setRpe(6)
      setNote('')
    }
  }, [open, session, defaultSport])

  // Strength sessions carry their exercises' sport — swapping it makes no sense.
  const sportLocked = editing && session.exercises.length > 0

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      if (session) {
        await api.updateSession(session.id, {
          date,
          sport,
          durationMin: duration,
          rpe,
          note: note.trim() || null,
        })
      } else {
        await api.createSession({
          date,
          sport,
          durationMin: duration,
          rpe,
          note: note.trim() || undefined,
          status: 'done',
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit session' : 'Log session'}
      sportClass={sportClass(sport)}
    >
      {sportLocked ? null : (
        <div className="field">
          <span className="type-eyebrow">Sport</span>
          <div className="sport-grid">
            {SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                className={`sport-grid__opt ${sportClass(s)}`}
                aria-pressed={s === sport}
                onClick={() => setSport(s)}
              >
                <SportIcon sport={s} />
                {SPORT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="type-eyebrow" htmlFor="log-date">
          Date
        </label>
        <input
          id="log-date"
          className="input input--mono"
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="field">
        <span className="type-eyebrow">Duration</span>
        <div className="chip-row">
          {durationOptions(duration).map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              aria-pressed={duration === m}
              onClick={() => setDuration(m)}
            >
              <span className="chip__value">{m}</span>
              <span className="chip__unit">min</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="type-eyebrow">Effort</span>
        <RpeSlider value={rpe} onChange={setRpe} />
      </div>

      <div className="field">
        <label className="type-eyebrow" htmlFor="log-note">
          Note
        </label>
        <textarea
          id="log-note"
          className="input"
          placeholder="Sparring rounds, drills, how it felt…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button
        type="button"
        className="btn btn--primary form-submit"
        disabled={saving || !date}
        onClick={() => void submit()}
      >
        {saving ? 'Saving…' : editing ? 'Save changes' : 'Log session'}
      </button>
    </Sheet>
  )
}
