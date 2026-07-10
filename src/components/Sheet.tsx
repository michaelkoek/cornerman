import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { IconX } from './icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  /** e.g. "sport-kickboxing" — colors the corner bracket */
  sportClass?: string
  children: ReactNode
}

/** Drag distance (px) past which the release dismisses the sheet. */
const CLOSE_THRESHOLD = 96

/**
 * Modal bottom sheet with the signature corner cut + bracket.
 * Slides up 320ms ease-swift; keeps itself mounted through the exit.
 * Swipe down (from the top of its content) to dismiss — iOS behaviour.
 */
export function Sheet({ open, onClose, title, sportClass, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const tracking = useRef(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setDragY(0)
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

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const el = sheetRef.current
    const touch = e.touches[0]
    // only start a drag when content is scrolled to the top, else let it scroll
    if (!el || el.scrollTop > 0 || !touch) return
    startY.current = touch.clientY
    tracking.current = true
  }

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!tracking.current) return
    const touch = e.touches[0]
    if (!touch) return
    const dy = touch.clientY - startY.current
    if (dy <= 0) {
      if (dragging) {
        setDragging(false)
        setDragY(0)
      }
      return
    }
    setDragging(true)
    setDragY(dy)
  }

  const onTouchEnd = () => {
    if (!tracking.current) return
    tracking.current = false
    if (dragY > CLOSE_THRESHOLD) {
      onClose()
    }
    setDragging(false)
    setDragY(0)
  }

  if (!mounted) return null

  return (
    <>
      <div className={`sheet__backdrop ${shown ? 'is-open' : ''}`} onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet corner-bracket ${sportClass ?? ''} ${shown ? 'is-open' : ''}`}
        style={dragging ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <span className="sheet__grabber" aria-hidden="true" />
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
