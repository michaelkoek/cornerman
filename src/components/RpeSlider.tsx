import type { CSSProperties } from 'react'
import { rpeWord } from '../lib/format'

interface RpeSliderProps {
  value: number
  onChange: (v: number) => void
}

/** 1–10 effort slider — mono readout, red fill, 28px thumb. */
export function RpeSlider({ value, onChange }: RpeSliderProps) {
  const pct = ((value - 1) / 9) * 100
  return (
    <div className="rpe">
      <div className="rpe__readout">
        <span className="rpe__value type-data-l">{value}</span>
        <span className="type-eyebrow">{rpeWord(value)}</span>
      </div>
      <input
        className="rpe__input"
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        aria-label="Rate of perceived exertion"
        style={{ '--rpe-pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="rpe__scale type-data-s">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  )
}
