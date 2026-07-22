import { useMemo, useState } from 'react'
import type { Session } from '../../shared/types'
import { api } from '../lib/api'
import {
  SPORT_LABEL,
  fmtShortDate,
  parseIso,
  sessionStats,
  sportClass,
  weekLabel,
  weekStartIso,
} from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { DiscardSheet } from '../components/DiscardSheet'
import { ManualLogSheet } from '../components/ManualLogSheet'
import { PullToRefresh } from '../components/PullToRefresh'
import { SwipeableRow } from '../components/SwipeableRow'
import { WorkoutDetailSheet } from '../components/WorkoutDetailSheet'
import { EmptyNotice, ErrorNotice, SkelRows, Skel } from '../components/Skeleton'
import { IconPlus, SportIcon } from '../components/icons'

interface WeekGroup {
  weekStart: string
  sessions: Session[]
}

function groupByWeek(sessions: Session[]): WeekGroup[] {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const groups: WeekGroup[] = []
  for (const s of sorted) {
    const ws = weekStartIso(parseIso(s.date))
    const last = groups[groups.length - 1]
    if (last && last.weekStart === ws) last.sessions.push(s)
    else groups.push({ weekStart: ws, sessions: [s] })
  }
  return groups
}

export default function Log() {
  const { data, error, loading, refreshing, reload } = useAsync(api.listSessions)
  const [logOpen, setLogOpen] = useState(false)
  const [selected, setSelected] = useState<Session | null>(null)
  const [editing, setEditing] = useState<Session | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const startEdit = (session: Session) => {
    setSelected(null)
    setEditing(session)
    setLogOpen(true)
  }

  const startDelete = (session: Session) => {
    setSelected(null)
    setDeleteTarget(session)
    setConfirmOpen(true)
  }

  const closeLogSheet = () => {
    setLogOpen(false)
    setEditing(null)
  }

  const groups = useMemo(() => (data ? groupByWeek(data) : []), [data])

  return (
    <main className="screen">
      <PullToRefresh onRefresh={reload} refreshing={refreshing} />
      <header className="screen-title">
        <h1 className="type-display-l">Log</h1>
      </header>

      {loading ? (
        <>
          <Skel h={12} w={100} style={{ marginBottom: 12 }} />
          <SkelRows rows={5} />
        </>
      ) : error ? (
        <ErrorNotice message={error} onRetry={reload} />
      ) : groups.length === 0 ? (
        <EmptyNotice text="Nothing logged yet. First bell rings when you do." />
      ) : (
        groups.map((g) => (
          <section key={g.weekStart}>
            <div className="week-head">
              <h2 className="type-eyebrow">{weekLabel(g.weekStart)}</h2>
              <span className="week-head__count">
                {g.sessions.length} session{g.sessions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="list-group">
              {g.sessions.map((s) => (
                <SwipeableRow
                  key={s.id}
                  actionLabel="Delete"
                  actionAriaLabel={`Delete session: ${SPORT_LABEL[s.sport]}, ${fmtShortDate(s.date)}`}
                  onAction={() => startDelete(s)}
                >
                  <SessionRow session={s} onOpen={() => setSelected(s)} />
                </SwipeableRow>
              ))}
            </div>
          </section>
        ))
      )}

      <button type="button" className="fab" aria-label="Log session" onClick={() => setLogOpen(true)}>
        <IconPlus size={24} />
      </button>

      <ManualLogSheet open={logOpen} onClose={closeLogSheet} onSaved={reload} session={editing} />
      <WorkoutDetailSheet
        session={selected}
        onClose={() => setSelected(null)}
        onEdit={startEdit}
        onDelete={startDelete}
        onChanged={reload}
      />
      {deleteTarget != null ? (
        <DiscardSheet
          open={confirmOpen}
          session={deleteTarget}
          onClose={() => setConfirmOpen(false)}
          onDiscarded={reload}
        />
      ) : null}
    </main>
  )
}

function SessionRow({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const muted = session.status === 'skipped' || session.status === 'planned'
  const title =
    session.source === 'strava'
      ? 'Run · Strava'
      : session.exercises.length > 0
        ? `${SPORT_LABEL[session.sport]} · ${session.location ?? 'session'}`
        : SPORT_LABEL[session.sport]

  return (
    <button
      type="button"
      className={`log-row ${sportClass(session.sport)} ${muted ? 'is-muted' : ''}`}
      onClick={onOpen}
    >
      <span className="log-row__icon">
        <SportIcon sport={session.sport} />
      </span>
      <span className="log-row__main">
        <span className="log-row__title" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="log-row__stats" style={{ display: 'block' }}>
          {muted ? session.status.replace('_', ' ') : sessionStats(session)}
        </span>
      </span>
      <span className="log-row__date">{fmtShortDate(session.date)}</span>
    </button>
  )
}
