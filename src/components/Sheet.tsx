import { useEffect, useState, type ReactNode } from 'react'
import { IconX } from './icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** e.g. "sport-kickboxing" — colors the corner bracket */
  sportClass?: string
  children: ReactNode
}

/**
 * Modal bottom sheet with the signature corner cut + bracket.
 * Slides up 320ms ease-swift; keeps itself mounted through the exit.
 */
export function Sheet({ open, onClose, title, sportClass, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // double-rAF so the closed transform paints before we transition
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    const t = window.setTimeout(() => setMounted(false), 340)
    return () => window.clearTimeout(t)
  }, [open])

  // ESC to close (desktop nicety)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <>
      <div className={`sheet__backdrop ${shown ? 'is-open' : ''}`} onClick={onClose} />
      <div
        className={`sheet corner-bracket ${sportClass ?? ''} ${shown ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet__inner">
          {title && (
            <header className="sheet__head">
              <h2 className="type-display-m">{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <IconX />
              </button>
            </header>
          )}
          {children}
        </div>
      </div>
    </>
  )
}
