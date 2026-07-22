import type { MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useSwipeReveal } from '../lib/useSwipeReveal'

interface ISwipeableRowProps {
  actionLabel: string
  actionAriaLabel: string
  onAction: () => void
  children: ReactNode
}

/**
 * Swipe-left-to-reveal wrapper for list rows. The revealed action is a
 * touch-only affordance — callers must offer the same action through a
 * visible, focusable control elsewhere (e.g. the row's detail view).
 */
export function SwipeableRow({ actionLabel, actionAriaLabel, onAction, children }: ISwipeableRowProps) {
  const [revealed, setRevealed] = useState(false)
  const { rootRef, offset, dragging, consumeDrag, handlers } = useSwipeReveal({
    revealed,
    onRevealChange: setRevealed,
  })

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (consumeDrag()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (revealed && !(event.target instanceof Element && event.target.closest('.swipe-row__action'))) {
      event.preventDefault()
      event.stopPropagation()
      setRevealed(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`swipe-row ${revealed ? 'is-open' : ''}`}
      onClickCapture={onClickCapture}
      {...handlers}
    >
      <button
        type="button"
        className="swipe-row__action"
        tabIndex={revealed ? 0 : -1}
        aria-hidden={!revealed}
        aria-label={actionAriaLabel}
        onClick={() => {
          setRevealed(false)
          onAction()
        }}
      >
        {actionLabel}
      </button>
      <div
        className="swipe-row__content"
        style={dragging ? { transform: `translateX(${offset}px)`, transition: 'none' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
