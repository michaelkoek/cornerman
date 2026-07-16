import { useState } from 'react'
import type { LibraryExercise } from '../../../shared/types'
import { AttributionLine } from '../../components/exerciseMedia/AttributionLine'
import { GifFigure } from '../../components/exerciseMedia/GifFigure'
import { InstructionSteps } from '../../components/exerciseMedia/InstructionSteps'
import { Sheet } from '../../components/Sheet'
import { libraryGif } from '../../lib/exerciseImages'
import { usePersist } from '../../lib/useAsync'

/** Bottom sheet with a library exercise's GIF, muscles, equipment, and how-to steps. */
export function LibraryDetailSheet({
  exercise,
  onClose,
}: {
  exercise: LibraryExercise | null
  onClose: () => void
}) {
  const persisted = usePersist(exercise)
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={persisted?.name ?? 'Exercise'}>
      {persisted && <DetailBody key={persisted.id} exercise={persisted} />}
    </Sheet>
  )
}

function DetailBody({ exercise }: { exercise: LibraryExercise }) {
  const [gifFailed, setGifFailed] = useState(false)

  return (
    <div className="example">
      {!gifFailed && (
        <GifFigure
          src={libraryGif(exercise.media)}
          alt={`${exercise.name} — animated demonstration`}
          onError={() => setGifFailed(true)}
        />
      )}

      <div className="exlog__muscles">
        <span className="exlog__muscle library__target">{exercise.target}</span>
        {exercise.secondaryMuscles.map((m) => (
          <span key={m} className="exlog__muscle">
            {m}
          </span>
        ))}
      </div>
      <p className="type-caption library__equipment">
        {exercise.bodyPart} · {exercise.equipment}
      </p>

      <InstructionSteps steps={exercise.steps} />
      {!gifFailed && <AttributionLine />}
    </div>
  )
}
