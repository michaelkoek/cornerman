import { useEffect, useRef, useState } from 'react'
import type { LibraryExercise } from '../../../shared/types'

/** Rows revealed per scroll chunk — keeps first paint cheap at 1,324 items. */
const CHUNK = 60

/** Filtered exercise list with chunked reveal (sentinel + IntersectionObserver). */
export function LibraryList({
  items,
  onSelect,
}: {
  items: LibraryExercise[]
  onSelect: (e: LibraryExercise) => void
}) {
  const [limit, setLimit] = useState(CHUNK)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLimit(CHUNK)
  }, [items])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((l) => l + CHUNK)
        }
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) {
    return <p className="library__empty type-caption">No exercises match these filters.</p>
  }

  return (
    <>
      <ul className="list-group library__list">
        {items.slice(0, limit).map((e) => (
          <li key={e.id} className="library__item">
            <button type="button" className="library-row" onClick={() => onSelect(e)}>
              <span className="library-row__name">{e.name}</span>
              <span className="library-row__meta">
                {e.target} · {e.equipment}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {limit < items.length && (
        <div ref={sentinelRef} className="library__sentinel" aria-hidden="true" />
      )}
    </>
  )
}
