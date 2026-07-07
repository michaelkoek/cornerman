import type { Session, Sport } from '../../shared/types'

// ---------------------------------------------------------------------------
// Sport metadata
// ---------------------------------------------------------------------------

export const SPORTS: Sport[] = [
  'kickboxing',
  'boxing',
  'running',
  'calisthenics',
  'weightlifting',
  'conditioning',
]

export const SPORT_LABEL: Record<Sport, string> = {
  kickboxing: 'Kickboxing',
  boxing: 'Boxing',
  running: 'Running',
  calisthenics: 'Calisthenics',
  weightlifting: 'Weightlifting',
  conditioning: 'Conditioning',
}

/** Hex values for SVG/chart fills — CSS vars don't resolve in SVG attributes. */
export const SPORT_HEX: Record<Sport, string> = {
  kickboxing: '#E2483D',
  boxing: '#4E8FD0',
  running: '#E0A33C',
  calisthenics: '#58B384',
  weightlifting: '#C9647F',
  conditioning: '#46B3AB',
}

export const sportClass = (sport: Sport): string => `sport-${sport}`

// ---------------------------------------------------------------------------
// Dates (local time; week starts Monday per the API contract)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

export function todayIso(): string {
  return toIso(new Date())
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "THU 6 JUL" */
export function fmtDayEyebrow(iso: string): string {
  const d = parseIso(iso)
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

/** "6 JUL" */
export function fmtShortDate(iso: string): string {
  const d = parseIso(iso)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

/** Monday of the week containing `d`, as ISO. */
export function weekStartIso(d: Date): string {
  const shift = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift))
}

/** "THIS WEEK" / "LAST WEEK" / "WK OF 23 JUN" */
export function weekLabel(weekStart: string): string {
  const current = weekStartIso(new Date())
  if (weekStart === current) return 'THIS WEEK'
  const diff = Math.round((parseIso(current).getTime() - parseIso(weekStart).getTime()) / DAY_MS)
  if (diff === 7) return 'LAST WEEK'
  return `WK OF ${fmtShortDate(weekStart)}`
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** 62.5 -> "62.5", 60 -> "60" */
export function fmtKg(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** seconds/km -> "5:24" */
export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 95 -> "01:35" */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Session summaries (Log screen rows, Today done card)
// ---------------------------------------------------------------------------

export function sessionStats(s: Session): string {
  if (s.sport === 'running' && s.distanceKm != null) {
    const pace = s.avgPaceSecPerKm != null ? ` · ${fmtPace(s.avgPaceSecPerKm)}/km` : ''
    return `${s.distanceKm.toFixed(1)} km${pace}`
  }
  if (s.exercises.length > 0) {
    const top = topSet(s)
    return `${s.exercises.length} exercises${top ? ` · ${top}` : ''}`
  }
  const bits: string[] = []
  if (s.durationMin != null) bits.push(`${s.durationMin} min`)
  if (s.rpe != null) bits.push(`RPE ${s.rpe}`)
  return bits.join(' · ') || '—'
}

/** Heaviest completed set across the session: "Bench Press 80×5". */
export function topSet(s: Session): string | null {
  let best: { name: string; kg: number; reps: number } | null = null
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (!set.done || set.weightKg == null) continue
      if (!best || set.weightKg > best.kg) {
        best = { name: ex.exercise.name, kg: set.weightKg, reps: set.reps }
      }
    }
  }
  return best ? `${best.name} ${fmtKg(best.kg)}×${best.reps}` : null
}

/** Derived title for a generated strength session: "PUSH + CORE". */
export function workoutTitle(s: Session): string {
  const cats: string[] = []
  for (const ex of s.exercises) {
    const c = ex.exercise.category
    if (!cats.includes(c)) cats.push(c)
  }
  if (cats.length === 0) return SPORT_LABEL[s.sport].toUpperCase()
  return cats.slice(0, 3).join(' + ').toUpperCase()
}

// ---------------------------------------------------------------------------
// Coach copy
// ---------------------------------------------------------------------------

export const RECOVERY_HINT: Record<'rest' | 'light' | 'moderate' | 'hard', string> = {
  hard: 'Hard session yesterday — going lighter today.',
  moderate: 'Solid work yesterday — steady pace today.',
  light: 'Easy day yesterday — you’ve got room to push.',
  rest: 'Fresh legs today — make them count.',
}

export function rpeWord(v: number): string {
  if (v <= 2) return 'EASY'
  if (v <= 4) return 'STEADY'
  if (v <= 6) return 'WORKING'
  if (v <= 8) return 'HARD'
  return 'ALL OUT'
}
