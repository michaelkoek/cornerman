import { useState } from 'react'
import type { Exercise } from '../../shared/types'
import { exampleImages, exampleSearchUrl } from '../lib/exerciseImages'
import { usePersist } from '../lib/useAsync'
import { Sheet } from './Sheet'

/**
 * Bottom sheet showing what an exercise looks like: start/finish photos
 * when we have them, otherwise the coaching cue plus a Google Images link.
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
  const urls = exampleImages(exercise.id)
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const visible = urls.filter((_, i) => !failed[i])

  return (
    <div className="example">
      {visible.length > 0 && (
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
      )}

      <p className="exlog__cue">{exercise.cue}</p>
      <div className="exlog__muscles">
        {exercise.muscleGroups.map((m) => (
          <span key={m} className="exlog__muscle">
            {m}
          </span>
        ))}
      </div>

      <a
        className="btn btn--ghost example__more"
        href={exampleSearchUrl(exercise.name)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {visible.length > 0 ? 'More examples' : 'See examples'} ↗
      </a>
    </div>
  )
}
