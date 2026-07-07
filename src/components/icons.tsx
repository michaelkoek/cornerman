// Hand-drawn 1.75px-stroke glyphs (Phosphor-light style) — no icon library.
import type { ReactNode } from 'react'
import type { Sport } from '../../shared/types'

interface IconProps {
  size?: number
  strokeWidth?: number
}

function Glyph({ size = 24, strokeWidth = 1.75, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/* ---------------- Tab bar ---------------- */

export function IconToday(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v3.5M16 3v3.5M3.5 9.5h17" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </Glyph>
  )
}

export function IconLog(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M9.5 6h11M9.5 12h11M9.5 18h11" />
      <path d="M3.5 7.5V4.5H6.5M3.5 13.5v-3h3M3.5 19.5v-3h3" strokeWidth={1.75} />
    </Glyph>
  )
}

export function IconProgress(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3.5 17.5l5-6.5 4 3.5 7.5-9" />
      <path d="M20 10V5.5h-4.5" />
    </Glyph>
  )
}

export function IconSettings(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4 6.5h9M18.5 6.5H20M4 12h1.5M9.5 12H20M4 17.5h7M15.5 17.5H20" />
      <circle cx="15.75" cy="6.5" r="2.25" />
      <circle cx="7.25" cy="12" r="2.25" />
      <circle cx="13.25" cy="17.5" r="2.25" />
    </Glyph>
  )
}

/* ---------------- Actions ---------------- */

export function IconPlus(p: IconProps) {
  return (
    <Glyph strokeWidth={2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  )
}

export function IconMinus(p: IconProps) {
  return (
    <Glyph strokeWidth={2} {...p}>
      <path d="M5 12h14" />
    </Glyph>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Glyph strokeWidth={2} {...p}>
      <path d="M4.5 12.5l5 5L19.5 7" />
    </Glyph>
  )
}

export function IconX(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Glyph>
  )
}

export function IconSwap(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4 8h13M14 4.5L17.5 8 14 11.5" />
      <path d="M20 16H7M10 12.5L6.5 16l3.5 3.5" />
    </Glyph>
  )
}

/* ---------------- Sport glyphs ---------------- */

function KickboxingGlyph(p: IconProps) {
  // heavy bag
  return (
    <Glyph {...p}>
      <path d="M12 2.5v3M9.5 5.5L12 2.5l2.5 3" />
      <rect x="8.5" y="5.5" width="7" height="14" rx="3.5" />
    </Glyph>
  )
}

function BoxingGlyph(p: IconProps) {
  // speed bag on its mount
  return (
    <Glyph {...p}>
      <path d="M6 4h12M12 4v2.5" />
      <path d="M12 6.5c3.2 1.8 4 4.5 4 6.7a4 4 0 1 1-8 0c0-2.2.8-4.9 4-6.7Z" />
    </Glyph>
  )
}

function RunningGlyph(p: IconProps) {
  // stopwatch
  return (
    <Glyph {...p}>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M10 2.5h4M12 2.5v4M12 13.5l3-3" />
    </Glyph>
  )
}

function CalisthenicsGlyph(p: IconProps) {
  // hanging from the bar
  return (
    <Glyph {...p}>
      <path d="M3 5h18M8.5 5v3.5M15.5 5v3.5" />
      <circle cx="12" cy="11" r="2.2" />
      <path d="M12 13.2V18M8.5 8.5l2 1.5M15.5 8.5l-2 1.5" />
    </Glyph>
  )
}

function WeightliftingGlyph(p: IconProps) {
  // barbell
  return (
    <Glyph {...p}>
      <path d="M2.5 12h3M18.5 12h3M8.6 12h6.8" />
      <rect x="5.5" y="7" width="3.1" height="10" rx="1.2" />
      <rect x="15.4" y="7" width="3.1" height="10" rx="1.2" />
    </Glyph>
  )
}

function ConditioningGlyph(p: IconProps) {
  // pulse line
  return (
    <Glyph {...p}>
      <path d="M3 12h3.5L9 6.5l4.5 11 2.5-5.5H21" />
    </Glyph>
  )
}

const SPORT_GLYPHS: Record<Sport, (p: IconProps) => ReactNode> = {
  kickboxing: KickboxingGlyph,
  boxing: BoxingGlyph,
  running: RunningGlyph,
  calisthenics: CalisthenicsGlyph,
  weightlifting: WeightliftingGlyph,
  conditioning: ConditioningGlyph,
}

export function SportIcon({ sport, size = 20 }: { sport: Sport; size?: number }) {
  const G = SPORT_GLYPHS[sport]
  return <>{G({ size })}</>
}
