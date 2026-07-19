import { usePullToRefresh } from '../lib/usePullToRefresh'

interface IPullToRefreshProps {
  onRefresh: () => void
  refreshing: boolean
}

/**
 * Drop-in refresh indicator for a screen. Mount once inside the screen's
 * `<main>`; it renders a fixed badge above the content that follows the
 * user's pull and spins while `refreshing` is true.
 */
export function PullToRefresh({ onRefresh, refreshing }: IPullToRefreshProps) {
  const { indicatorRef, phase } = usePullToRefresh({ onRefresh, refreshing })

  return (
    <div ref={indicatorRef} className="ptr" data-phase={phase}>
      <span className="ptr__spinner" aria-hidden="true" />
      <span className="visually-hidden" role="status" aria-live="polite">
        {phase === 'refreshing' ? 'Refreshing content' : ''}
      </span>
    </div>
  )
}
