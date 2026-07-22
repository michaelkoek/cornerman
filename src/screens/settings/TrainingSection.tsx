import { useState } from 'react'
import type { Settings } from '../../../shared/types'
import { api } from '../../lib/api'
import { fmtClock } from '../../lib/format'
import { IconMinus, IconPlus } from '../../components/icons'

const REST_STEP_SECONDS = 15
const REST_MIN_SECONDS = 15
const REST_MAX_SECONDS = 300

type SetSettings = (next: Settings | ((prev: Settings) => Settings)) => void
type TrainingPatch = Partial<Pick<Settings, 'weeklyTarget' | 'defaultRestSeconds'>>

export function TrainingSection({
  settings,
  setData,
}: {
  settings: Settings
  setData: SetSettings
}) {
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = (patch: TrainingPatch, revert: TrainingPatch, message: string) => {
    setData((s) => ({ ...s, ...patch }))
    setSaveError(null)
    api.updateSettings(patch).catch(() => {
      setData((s) => ({ ...s, ...revert }))
      setSaveError(message)
    })
  }

  const changeTarget = (delta: number) => {
    const next = Math.min(14, Math.max(1, settings.weeklyTarget + delta))
    if (next === settings.weeklyTarget) {
      return
    }
    save(
      { weeklyTarget: next },
      { weeklyTarget: settings.weeklyTarget },
      'Could not save the target.',
    )
  }

  const changeRest = (direction: number) => {
    const next = Math.min(
      REST_MAX_SECONDS,
      Math.max(REST_MIN_SECONDS, settings.defaultRestSeconds + direction * REST_STEP_SECONDS),
    )
    if (next === settings.defaultRestSeconds) {
      return
    }
    save(
      { defaultRestSeconds: next },
      { defaultRestSeconds: settings.defaultRestSeconds },
      'Could not save the rest time.',
    )
  }

  return (
    <section className="section" style={{ marginTop: 0 }}>
      <div className="section__head">
        <h2 className="type-display-m">Training</h2>
      </div>
      <div className="list-group">
        <StepperRow
          title="Weekly target"
          hint="Sessions per week to keep the streak alive"
          value={String(settings.weeklyTarget)}
          decDisabled={settings.weeklyTarget <= 1}
          incDisabled={settings.weeklyTarget >= 14}
          onStep={changeTarget}
        />
        <StepperRow
          title="Rest timer"
          hint="Default rest between sets"
          value={fmtClock(settings.defaultRestSeconds)}
          decDisabled={settings.defaultRestSeconds <= REST_MIN_SECONDS}
          incDisabled={settings.defaultRestSeconds >= REST_MAX_SECONDS}
          onStep={changeRest}
        />
      </div>
      {saveError && <p className="form-error">{saveError}</p>}
    </section>
  )
}

function StepperRow({
  title,
  hint,
  value,
  decDisabled,
  incDisabled,
  onStep,
}: {
  title: string
  hint: string
  value: string
  decDisabled: boolean
  incDisabled: boolean
  onStep: (direction: number) => void
}) {
  return (
    <div className="setting-row">
      <div className="setting-row__label">
        <p className="type-title">{title}</p>
        <p className="setting-row__hint">{hint}</p>
      </div>
      <div className="mini-stepper">
        <button
          type="button"
          className="mini-stepper__btn"
          aria-label={`Decrease ${title.toLowerCase()}`}
          disabled={decDisabled}
          onClick={() => onStep(-1)}
        >
          <IconMinus size={18} />
        </button>
        <span className="mini-stepper__value">{value}</span>
        <button
          type="button"
          className="mini-stepper__btn"
          aria-label={`Increase ${title.toLowerCase()}`}
          disabled={incDisabled}
          onClick={() => onStep(1)}
        >
          <IconPlus size={18} />
        </button>
      </div>
    </div>
  )
}
