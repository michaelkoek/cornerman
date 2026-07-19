import { useState } from 'react'
import type { Settings as SettingsShape, Sport } from '../../shared/types'
import { api } from '../lib/api'
import { signOut } from '../lib/auth'
import { SPORTS, SPORT_LABEL, WEEKDAY_FULL, sportClass } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { PullToRefresh } from '../components/PullToRefresh'
import { Sheet } from '../components/Sheet'
import { ErrorNotice, Skel } from '../components/Skeleton'
import { IconMinus, IconPlus, IconX, SportIcon } from '../components/icons'

export default function Settings() {
  const { data, error, loading, refreshing, reload, setData } = useAsync(api.settings)

  if (loading) return <SettingsSkeleton />
  if (error || !data) {
    return (
      <main className="screen">
        <header className="screen-title">
          <h1 className="type-display-l">Settings</h1>
        </header>
        <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
      </main>
    )
  }

  return (
    <main className="screen">
      <PullToRefresh onRefresh={reload} refreshing={refreshing} />
      <header className="screen-title">
        <h1 className="type-display-l">Settings</h1>
      </header>

      <TargetSection settings={data} setData={setData} />
      <AnchorsSection settings={data} reload={reload} setData={setData} />
      <StravaSection settings={data} />
      <AccountSection />
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Weekly target                                                        */
/* ------------------------------------------------------------------ */

function TargetSection({
  settings,
  setData,
}: {
  settings: SettingsShape
  setData: (next: SettingsShape | ((prev: SettingsShape) => SettingsShape)) => void
}) {
  const [saveError, setSaveError] = useState<string | null>(null)

  const change = (delta: number) => {
    const next = Math.min(14, Math.max(1, settings.weeklyTarget + delta))
    if (next === settings.weeklyTarget) return
    setData((s) => ({ ...s, weeklyTarget: next }))
    setSaveError(null)
    api.updateSettings({ weeklyTarget: next }).catch(() => {
      setData((s) => ({ ...s, weeklyTarget: settings.weeklyTarget }))
      setSaveError('Could not save the target.')
    })
  }

  return (
    <section className="section" style={{ marginTop: 0 }}>
      <div className="section__head">
        <h2 className="type-display-m">Training</h2>
      </div>
      <div className="list-group">
        <div className="setting-row">
          <div className="setting-row__label">
            <p className="type-title">Weekly target</p>
            <p className="setting-row__hint">Sessions per week to keep the streak alive</p>
          </div>
          <div className="mini-stepper">
            <button
              type="button"
              className="mini-stepper__btn"
              aria-label="Decrease weekly target"
              disabled={settings.weeklyTarget <= 1}
              onClick={() => change(-1)}
            >
              <IconMinus size={18} />
            </button>
            <span className="mini-stepper__value">{settings.weeklyTarget}</span>
            <button
              type="button"
              className="mini-stepper__btn"
              aria-label="Increase weekly target"
              disabled={settings.weeklyTarget >= 14}
              onClick={() => change(1)}
            >
              <IconPlus size={18} />
            </button>
          </div>
        </div>
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Anchors                                                              */
/* ------------------------------------------------------------------ */

function AnchorsSection({
  settings,
  reload,
  setData,
}: {
  settings: SettingsShape
  reload: () => void
  setData: (next: SettingsShape | ((prev: SettingsShape) => SettingsShape)) => void
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

  const anchors = [...settings.anchors].sort((a, b) => a.weekday - b.weekday || (a.time < b.time ? -1 : 1))

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

/* ------------------------------------------------------------------ */
/* Strava                                                               */
/* ------------------------------------------------------------------ */

function StravaSection({ settings }: { settings: SettingsShape }) {
  const connected = settings.stravaConnected

  return (
    <section className="section sport-running">
      <div className="section__head">
        <h2 className="type-display-m">Strava</h2>
      </div>
      <div className="card corner-cut corner-bracket">
        <div className="row-between" style={{ paddingLeft: 'var(--space-3)' }}>
          <div className="strava-status">
            <span className={`strava-status__dot ${connected ? 'is-on' : ''}`} />
            {connected ? 'Connected — runs import automatically' : 'Not connected'}
          </div>
        </div>
        <p className="settings-note">
          Runs are synced in the background (via n8n) — there’s nothing to connect here.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Account (sign out)                                                   */
/* ------------------------------------------------------------------ */

function AccountSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const out = async () => {
    setBusy(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.')
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="type-display-m">Account</h2>
      </div>
      <button
        type="button"
        className="btn btn--ghost signout-row"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={() => void out()}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <header className="screen-title">
        <h1 className="type-display-l">Settings</h1>
      </header>
      <div className="skel-stack">
        <Skel h={80} r="var(--radius-m)" />
        <Skel h={160} r="var(--radius-m)" />
        <Skel h={140} r="var(--radius-l)" />
      </div>
    </main>
  )
}
