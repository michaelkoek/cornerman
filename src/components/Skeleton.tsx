import type { CSSProperties } from 'react'

interface SkelProps {
  h: number
  w?: number | string
  r?: number | string
  style?: CSSProperties
}

/** Shimmering placeholder block (tokens.css `.skeleton`). */
export function Skel({ h, w = '100%', r, style }: SkelProps) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

/** Layout-matching loading state for a list of rows. */
export function SkelRows({ rows = 4, h = 64 }: { rows?: number; h?: number }) {
  return (
    <div className="skel-stack">
      {Array.from({ length: rows }, (_, i) => (
        <Skel key={i} h={h} r="var(--radius-m)" />
      ))}
    </div>
  )
}

interface ErrorNoticeProps {
  message: string
  onRetry?: () => void
}

export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div className="notice" role="alert">
      <div className="notice__bracket is-danger" />
      <p className="notice__text">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyNotice({ text }: { text: string }) {
  return (
    <div className="notice">
      <div className="notice__bracket" />
      <p className="notice__text">{text}</p>
    </div>
  )
}
