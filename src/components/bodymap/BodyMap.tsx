import type { KeyboardEvent } from 'react'
import type { Muscle } from '../../../shared/types'
import {
  BODYMAP_VIEWBOX,
  MUSCLE_LABEL,
  SILHOUETTE,
  VIEW_REGIONS,
  type BodyView,
  type IBodyRegion,
} from './regions'

interface IBodyMapProps {
  view: BodyView
  label: string
  /** Highlighted muscles (single- and multi-select parents both pass a list). */
  selected?: readonly Muscle[]
  /** Interactive filter mode: tap toggles a muscle; parent owns the selection. */
  onToggle?: (muscle: Muscle) => void
  /** Display mode: class per muscle (e.g. heatmap bucket fill). */
  fillClass?: (muscle: Muscle) => string
  /** Extra context for screen readers per region, e.g. an exercise count. */
  describe?: (muscle: Muscle) => string
}

/**
 * Simplified human figure with tappable muscle regions. With `onToggle` it is
 * an interactive filter; with `fillClass` it renders as a static heatmap.
 * MuscleWiki-style, drawn in-repo — no external assets.
 */
export function BodyMap({ view, label, selected, onToggle, fillClass, describe }: IBodyMapProps) {
  const interactive = onToggle !== undefined
  const regions = VIEW_REGIONS[view]

  return (
    <svg
      className="bodymap"
      viewBox={BODYMAP_VIEWBOX}
      role={interactive ? 'group' : 'img'}
      aria-label={label}
    >
      <g className="bodymap__silhouette" aria-hidden="true">
        {SILHOUETTE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {regions.map((region) => (
        <Region
          key={region.muscle}
          region={region}
          selected={selected?.includes(region.muscle) ?? false}
          onToggle={onToggle}
          fillClass={fillClass}
          describe={describe}
        />
      ))}
    </svg>
  )
}

function Region({
  region,
  selected,
  onToggle,
  fillClass,
  describe,
}: {
  region: IBodyRegion
  selected: boolean
  onToggle?: (muscle: Muscle) => void
  fillClass?: (muscle: Muscle) => string
  describe?: (muscle: Muscle) => string
}) {
  const { muscle } = region
  const toggle = () => {
    if (onToggle) {
      onToggle(muscle)
    }
  }
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  const classes = [
    'bodymap__region',
    selected ? 'bodymap__region--selected' : '',
    fillClass ? fillClass(muscle) : '',
  ]
    .filter((c) => c.length > 0)
    .join(' ')

  const interactiveProps = onToggle
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-pressed': selected,
        'aria-label': describe ? describe(muscle) : MUSCLE_LABEL[muscle],
        onClick: toggle,
        onKeyDown,
      }
    : {}

  return (
    <g className={classes} {...interactiveProps}>
      {region.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {onToggle &&
        region.paths.map((d) => (
          // Invisible fat-stroke twin so narrow regions stay tappable one-handed.
          <path key={`hit-${d}`} className="bodymap__hit" d={d} aria-hidden="true" />
        ))}
    </g>
  )
}
