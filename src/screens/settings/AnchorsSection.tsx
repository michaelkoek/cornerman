import { useState } from 'react'
import type { Settings, Sport } from '../../../shared/types'
import { api } from '../../lib/api'
import { SPORTS, SPORT_LABEL, WEEKDAY_FULL, sportClass } from '../../lib/format'
import { Sheet } from '../../components/Sheet'
import { IconX, SportIcon } from '../../components/icons'

type SetSettings = (next: Settings | ((prev: Settings) => Settings)) => void

export function AnchorsSection({
  settings,
  reload,
  setData,
}: {
  settings: Settings
  reload: () => void
  setData: SetSettings
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const remove = (id: string) => {
    setRemoveError(null)
    setData((s) => ({ ...s, anchors: s.anchors.filter((a) => a.id !== id) }))
    api.deleteAnchor(id).catch(() => {
      setRemoveError('Could not remove the anchor.')
      reload()
    })
  }

  const anchors = [...settings.anchors].sort(
    (a, b) => a.weekday - b.weekday || (a.time < b.time ? -1 : 1),
  )

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="type-display-m">Anchors</h2>
        <span className="section__sub">fixed weekly sessions</span>
      </div>
      {anchors.length === 0 ? (
        <p className="type-caption" style={{ color: 'var(--text-tertiary)' }}>
          No anchors yet — pin your fixed classes so Today plans around them.
        </p>
      ) : (
        <div className="list-group">
          {anchors.map((a) => (
            <div key={a.id} className={`setting-row ${sportClass(a.sport)}`}>
              <div className="setting-row__label">
                <p className="type-title">{a.label}</p>
                <p className="anchor-row__time">
                  {WEEKDAY_FULL[a.weekday]} · {a.time}
                </p>
              </div>
              <span className="tag">{SPORT_LABEL[a.sport]}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${a.label}`}
                onClick={() => remove(a.id)}
              >
                <IconX size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      {removeError && <p className="form-error">{removeError}</p>}
      <button
        type="button"
        className="btn btn--ghost"
        style={{ width: '100%', marginTop: 'var(--space-4)' }}
        onClick={() => setAddOpen(true)}
      >
        Add anchor
      </button>

      <AddAnchorSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false)
          reload()
        }}
      />
    </section>
  )
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // render Mon..Sun
const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function AddAnchorSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const [weekday, setWeekday] = useState(4)
  const [sport, setSport] = useState<Sport>('kickboxing')
  const [time, setTime] = useState('19:00')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await api.addAnchor({
        weekday,
        sport,
        time,
        label: label.trim() || `${SPORT_LABEL[sport]} class`,
      })
      setLabel('')
      onAdded()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the anchor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add anchor" sportClass={sportClass(sport)}>
      <div className="field">
        <span className="type-eyebrow">Day</span>
        <div className="weekday-row">
          {WEEKDAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              className="weekday-row__opt"
              aria-label={WEEKDAY_FULL[d]}
              aria-pressed={weekday === d}
              onClick={() => setWeekday(d)}
            >
              {WEEKDAY_LETTER[d]}
            </button>
          ))}
        </div>
      </div>

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
        <label className="type-eyebrow" htmlFor="anchor-time">
          Time
        </label>
        <input
          id="anchor-time"
          className="input input--mono"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="type-eyebrow" htmlFor="anchor-label">
          Label
        </label>
        <input
          id="anchor-label"
          className="input"
          type="text"
          placeholder={`${SPORT_LABEL[sport]} class`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      {formError && <p className="form-error">{formError}</p>}

      <button
        type="button"
        className="btn btn--primary form-submit"
        disabled={saving || !time}
        onClick={() => void submit()}
      >
        {saving ? 'Saving…' : 'Add anchor'}
      </button>
    </Sheet>
  )
}
