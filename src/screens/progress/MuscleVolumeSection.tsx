import type { DashboardResponse, Muscle } from '../../../shared/types'
import { BodyMap } from '../../components/bodymap/BodyMap'
import { MUSCLE_LABEL } from '../../components/bodymap/regions'
import { volumeBucket } from '../../lib/muscleVolume'

const LEGEND: { bucket: number; label: string }[] = [
  { bucket: 0, label: '0' },
  { bucket: 1, label: '1–4' },
  { bucket: 2, label: '5–9' },
  { bucket: 3, label: '10–14' },
  { bucket: 4, label: '15+' },
]

interface IMuscleVolumeSectionProps {
  muscleVolume: NonNullable<DashboardResponse['muscleVolume']>
}

/**
 * Sets-per-muscle heatmap over the last 7 days: front + back body maps
 * colored by volume bucket, with the sorted text list as the accessible
 * representation ("full-body" work appears in the list only).
 */
export function MuscleVolumeSection({ muscleVolume }: IMuscleVolumeSectionProps) {
  const setsFor = new Map<Muscle, number>(muscleVolume.map((v) => [v.muscle, v.sets]))
  const fillClass = (muscle: Muscle) => `bodymap__fill-${volumeBucket(setsFor.get(muscle) ?? 0)}`

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="type-display-m">Muscle volume</h2>
        <span className="section__sub">sets · 7 days</span>
      </div>

      <div className="bodymap-pair" aria-hidden="true">
        <div>
          <BodyMap view="front" label="Front muscle volume heatmap" fillClass={fillClass} />
          <p className="type-eyebrow bodymap-pair__label">Front</p>
        </div>
        <div>
          <BodyMap view="back" label="Back muscle volume heatmap" fillClass={fillClass} />
          <p className="type-eyebrow bodymap-pair__label">Back</p>
        </div>
      </div>

      <div className="muscle-volume__legend" aria-hidden="true">
        {LEGEND.map(({ bucket, label }) => (
          <span key={bucket} className="muscle-volume__legend-item">
            <span className={`muscle-volume__swatch bodymap__fill-${bucket}`} />
            {label}
          </span>
        ))}
      </div>

      {muscleVolume.length === 0 ? (
        <p className="type-caption">No sets logged in the last 7 days.</p>
      ) : (
        <ul className="muscle-volume__list" aria-label="Sets per muscle, last 7 days">
          {muscleVolume.map(({ muscle, sets }) => (
            <li key={muscle} className="muscle-volume__row">
              <span className="type-body">{MUSCLE_LABEL[muscle]}</span>
              <span className="muscle-volume__sets">{formatSets(sets)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatSets(sets: number): string {
  if (Number.isInteger(sets)) {
    return String(sets)
  }
  return sets.toFixed(1)
}
