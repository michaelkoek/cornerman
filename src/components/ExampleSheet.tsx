import { useState } from 'react'
import type { Exercise } from '../../shared/types'
import { exampleGif, exampleImages, exampleSearchUrl } from '../lib/exerciseImages'
import { libraryById } from '../lib/exerciseLibrary'
import { useAsync, usePersist } from '../lib/useAsync'
import { AttributionLine } from './exerciseMedia/AttributionLine'
import { GifFigure } from './exerciseMedia/GifFigure'
import { InstructionSteps } from './exerciseMedia/InstructionSteps'
import { Sheet } from './Sheet'

/**
 * Bottom sheet showing what an exercise looks like: an animated demo GIF
 * (dataset-linked exercises) or start/finish photos, the coaching cue,
 * how-to steps, and a Google Images fallback link.
 */
export function ExampleSheet({
  exercise,
  onClose,
}: {
  exercise: Exercise | null
  onClose: () => void
}) {
  const persisted = usePersist(exercise)
  return (
    <Sheet open={exercise !== null} onClose={onClose} title={persisted?.name ?? 'Example'}>
      {persisted && <ExampleBody key={persisted.id} exercise={persisted} />}
    </Sheet>
  )
}

const FRAME_LABEL = ['Start', 'Finish']

function ExampleBody({ exercise }: { exercise: Exercise }) {
  const gifUrl = exampleGif(exercise.datasetId)
  const [gifFailed, setGifFailed] = useState(false)
  const showGif = gifUrl !== null && !gifFailed

  const { data: libraryEntry } = useAsync(() =>
    exercise.datasetId ? libraryById(exercise.datasetId) : Promise.resolve(null),
  )

  return (
    <div className="example">
      {showGif ? (
        <GifFigure
          src={gifUrl}
          alt={`${exercise.name} — animated demonstration`}
          onError={() => setGifFailed(true)}
        />
      ) : (
        <PhotoFrames exercise={exercise} />
      )}

      <p className="exlog__cue">{exercise.cue}</p>
      <div className="exlog__muscles">
        {exercise.muscleGroups.map((m) => (
          <span key={m} className="exlog__muscle">
            {m}
          </span>
        ))}
      </div>

      {libraryEntry && <InstructionSteps steps={libraryEntry.steps} />}
      {showGif && <AttributionLine />}

      <a
        className="btn btn--ghost example__more"
        href={exampleSearchUrl(exercise.name)}
        target="_blank"
        rel="noopener noreferrer"
      >
        More examples ↗
      </a>
    </div>
  )
}

function PhotoFrames({ exercise }: { exercise: Exercise }) {
  const urls = exampleImages(exercise.id)
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const visible = urls.filter((_, i) => !failed[i])

  if (visible.length === 0) {
    return null
  }
  return (
    <div className="example__frames">
      {urls.map(
        (url, i) =>
          !failed[i] && (
            <figure key={url} className="example__frame">
              <img
                className="example__img"
                src={url}
                alt={`${exercise.name} — ${FRAME_LABEL[i] ?? `step ${i + 1}`}`}
                loading="lazy"
                onError={() => setFailed((f) => ({ ...f, [i]: true }))}
              />
              {urls.length > 1 && (
                <figcaption className="type-eyebrow example__frame-label">
                  {FRAME_LABEL[i] ?? `Step ${i + 1}`}
                </figcaption>
              )}
            </figure>
          ),
      )}
    </div>
  )
}
