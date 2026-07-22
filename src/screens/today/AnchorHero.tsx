import { useState } from 'react'
import type { Anchor, TodayResponse } from '../../../shared/types'
import { api } from '../../lib/api'
import { SPORT_LABEL, sportClass } from '../../lib/format'
import { st } from '../../lib/stagger'
import { RpeSlider } from '../../components/RpeSlider'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'

interface IAnchorHeroProps {
  anchor: Anchor
  data: TodayResponse
  onSaved: () => void
}

/** Hero for a scheduled anchor (class/club session) with a quick-log sheet. */
export function AnchorHero({ anchor, data, onSaved }: IAnchorHeroProps) {
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(60)
  const [rpe, setRpe] = useState(7)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const round = Math.min(data.weekSessions + 1, Math.max(data.weeklyTarget, 1))

  const save = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await api.createSession({
        date: data.date,
        sport: anchor.sport,
        durationMin: duration,
        rpe,
        note: note.trim() || undefined,
        status: 'done',
      })
      setOpen(false)
      onSaved()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not log the session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section
        className={`card card--hero corner-cut corner-bracket stagger-item ${sportClass(anchor.sport)}`}
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow">Today · {anchor.time}</span>
          <span className="tag">{SPORT_LABEL[anchor.sport]}</span>
        </div>
        <h2 className="type-display-xl hero__name">{anchor.label}</h2>
        <p className="hero__meta">
          {anchor.time} · RD {round}/{data.weeklyTarget} this week
        </p>
        <button type="button" className="btn btn--primary hero__cta" onClick={() => setOpen(true)}>
          Log it
        </button>
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={anchor.label}
        sportClass={sportClass(anchor.sport)}
      >
        <div className="field">
          <span className="type-eyebrow">Duration · min</span>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Stepper value={duration} unit="min" step={5} min={5} max={240} onChange={setDuration} />
          </div>
        </div>
        <div className="field">
          <span className="type-eyebrow">Effort</span>
          <RpeSlider value={rpe} onChange={setRpe} />
        </div>
        <div className="field">
          <label className="type-eyebrow" htmlFor="anchor-note">
            Note
          </label>
          <textarea
            id="anchor-note"
            className="input"
            placeholder="Rounds, partners, what landed…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button
          type="button"
          className="btn btn--primary form-submit"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Log session'}
        </button>
      </Sheet>
    </>
  )
}
