import { useEffect, useRef } from 'react'

/**
 * Home-screen (standalone) PWAs run in WKWebView on iOS, which drops native
 * pinch-to-zoom entirely — no viewport-meta or CSS setting brings it back.
 * This re-implements two-finger pinch + pan as a CSS transform on the
 * returned ref's element, snapping back to scale 1 when fingers lift near it.
 */
export function usePinchZoom<T extends HTMLElement>(maxScale = 3) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let scale = 1
    let panX = 0
    let panY = 0
    let startDist = 0
    let startScale = 1
    let startPanX = 0
    let startPanY = 0
    let startMidX = 0
    let startMidY = 0

    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const midpoint = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    })

    const clampPan = (container: HTMLElement) => {
      const rect = container.getBoundingClientRect()
      const maxX = (rect.width * (scale - 1)) / 2
      const maxY = (rect.height * (scale - 1)) / 2
      panX = Math.min(maxX, Math.max(-maxX, panX))
      panY = Math.min(maxY, Math.max(-maxY, panY))
    }

    const apply = () => {
      el.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      startDist = distance(e.touches)
      startScale = scale
      startPanX = panX
      startPanY = panY
      const m = midpoint(e.touches)
      startMidX = m.x
      startMidY = m.y
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !el.parentElement) return
      e.preventDefault()
      const d = distance(e.touches)
      scale = Math.min(maxScale, Math.max(1, startScale * (d / startDist)))
      const m = midpoint(e.touches)
      panX = startPanX + (m.x - startMidX)
      panY = startPanY + (m.y - startMidY)
      clampPan(el.parentElement)
      apply()
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0 || scale > 1.02) return
      scale = 1
      panX = 0
      panY = 0
      el.style.transition = 'transform 200ms ease'
      apply()
      window.setTimeout(() => {
        el.style.transition = ''
      }, 200)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [maxScale])

  return ref
}
