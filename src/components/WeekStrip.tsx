import { parseIso } from '../lib/format'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

interface IWeekStripProps {
  /** Monday-first flags: true where a done session exists. */
  days: boolean[]
  /** Today's ISO date — marks the current column. */
  date: string
}

function dayClass(trained: boolean, index: number, todayIndex: number): string {
  const classes = ['week-strip__day']
  if (trained) {
    classes.push('is-trained')
  }
  if (index === todayIndex) {
    classes.push('is-today')
  }
  if (!trained && index > todayIndex) {
    classes.push('is-future')
  }
  return classes.join(' ')
}

/** Mon–Sun training dots under the Today header. */
export function WeekStrip({ days, date }: IWeekStripProps) {
  const todayIndex = (parseIso(date).getDay() + 6) % 7
  const trainedNames = DAY_NAMES.filter((_, i) => days[i] ?? false)
  const label =
    trainedNames.length > 0
      ? `Trained ${trainedNames.join(', ')} this week`
      : 'No sessions yet this week'

  return (
    <div className="week-strip" role="img" aria-label={label}>
      {DAY_LETTERS.map((letter, i) => (
        <span key={DAY_NAMES[i]} className={dayClass(days[i] ?? false, i, todayIndex)}>
          <span className="week-strip__letter">{letter}</span>
          <span className="week-strip__dot" />
        </span>
      ))}
    </div>
  )
}
