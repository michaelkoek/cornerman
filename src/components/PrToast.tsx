import { useEffect, useRef, useState } from 'react'

const SHOW_MS = 2600
const EXIT_MS = 340

/**
 * Personal-record banner — slides up above the tab bar when a logged set
 * beats an all-time record, then dismisses itself. Remount (new key) to
 * show the next one.
 */
export function PrToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [shown, setShown] = useState(false)
  // Keep onDone in a ref so a new inline-arrow identity from the parent
  // doesn't restart the dismiss timers on every re-render.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    // double-rAF so the closed transform paints before we transition (same as Sheet)
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    const hide = window.setTimeout(() => setShown(false), SHOW_MS)
    const done = window.setTimeout(() => onDoneRef.current(), SHOW_MS + EXIT_MS)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(hide)
      window.clearTimeout(done)
    }
  }, [])

  return (
    <div className={`pr-toast corner-bracket ${shown ? 'is-open' : ''}`} role="status">
      <p className="type-eyebrow pr-toast__eyebrow">Personal record</p>
      <p className="pr-toast__msg">{message}</p>
    </div>
  )
}
