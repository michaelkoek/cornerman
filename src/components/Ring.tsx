import { useEffect, useState } from 'react'

interface RingProps {
  value: number
  target: number
  size?: 64 | 160
  streakWeeks?: number
}

/** Streak / weekly-target ring per DESIGN.md §5.5. */
export function Ring({ value, target, size = 64, streakWeeks }: RingProps) {
  const large = size === 160
  const strokeWidth = large ? 8 : 5
  const r = size / 2 - strokeWidth - 1
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const fraction = target > 0 ? Math.min(1, value / target) : 0
  const met = target > 0 && value >= target

  // draw-in on mount: start at 0, transition to the real offset (tokens.css
  // animates stroke-dashoffset 800ms ease-out with 200ms delay)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  const offset = circumference * (1 - (drawn ? fraction : 0))

  return (
    <div
      className={`ring ${large ? 'ring--large' : ''} ${met ? 'is-met' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} of ${target} sessions this week`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring__track" cx={c} cy={c} r={r} fill="none" strokeWidth={strokeWidth} />
        <circle
          className="ring__fill"
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__center">
        <span className="ring__count">{value}</span>
        <span className="ring__target">/{target}</span>
        {large && streakWeeks !== undefined && (
          <span className="type-eyebrow" style={{ marginTop: 6 }}>
            {streakWeeks} wk streak
          </span>
        )}
      </div>
    </div>
  )
}
