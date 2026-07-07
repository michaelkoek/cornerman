import { useState } from 'react'
import type { Sport } from '../../shared/types'
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
}

/** Manual CreateSessionRequest form: sport, date, duration, RPE, note. */
export function ManualLogSheet({ open, onClose, onSaved, defaultSport }: ManualLogSheetProps) {
  const [sport, setSport] = useState<Sport>(defaultSport ?? 'kickboxing')
  const [date, setDate] = useState(todayIso())
  const [duration, setDuration] = useState(60)
  const [rpe, setRpe] = useState(6)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.createSession({
        date,
        sport,
        durationMin: duration,
        rpe,
        note: note.trim() || undefined,
        status: 'done',
      })
      setNote('')
      setDate(todayIso())
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log session" sportClass={sportClass(sport)}>
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
          {[30, 45, 60, 90].map((m) => (
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
        {saving ? 'Saving…' : 'Log session'}
      </button>
    </Sheet>
  )
}
