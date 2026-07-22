import type { TodayResponse } from '../../../shared/types'
import { RECOVERY_HINT } from '../../lib/format'
import { st } from '../../lib/stagger'

export function CoachHint({ load }: { load: TodayResponse['yesterdayLoad'] }) {
  return (
    <p className="coach-line stagger-item" style={st(1)}>
      {RECOVERY_HINT[load]}
    </p>
  )
}
