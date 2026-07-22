import { useState } from 'react'
import type { Session, TodayResponse } from '../../shared/types'
import { api } from '../lib/api'
import { fmtDayEyebrow } from '../lib/format'
import { st } from '../lib/stagger'
import { useAsync } from '../lib/useAsync'
import { PullToRefresh } from '../components/PullToRefresh'
import { RestTimer } from '../components/RestTimer'
import { Ring } from '../components/Ring'
import { Skel, ErrorNotice } from '../components/Skeleton'
import { AnchorHero } from './today/AnchorHero'
import { CoachHint } from './today/CoachHint'
import { DoneCard } from './today/DoneCard'
import { PlannerSection } from './today/PlannerSection'
import { WorkoutView } from './today/WorkoutView'

export default function Today() {
  const { data, error, loading, refreshing, reload, setData } = useAsync(api.today)
  const [restKey, setRestKey] = useState<number | null>(null)

  const setSession = (updater: (prev: Session) => Session) => {
    setData((d) => (d.session ? { ...d, session: updater(d.session) } : d))
  }

  if (loading) return <TodaySkeleton />
  if (error || !data) {
    return (
      <main className="screen">
        <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
      </main>
    )
  }

  const session = data.session && data.session.status !== 'skipped' ? data.session : null
  const active = session && session.status !== 'done' ? session : null

  return (
    <main className="screen">
      <PullToRefresh onRefresh={reload} refreshing={refreshing} />
      <TodayHeader data={data} />

      {session?.status === 'done' ? (
        <>
          <DoneCard session={session} date={data.date} />
          <PlannerSection onSession={(s) => setData({ ...data, session: s })} secondary />
        </>
      ) : active ? (
        <WorkoutView
          today={data}
          session={active}
          onLocal={setSession}
          reload={reload}
          onRest={() => setRestKey(Date.now())}
          onRestCancel={() => setRestKey(null)}
        />
      ) : data.anchor ? (
        <>
          <AnchorHero anchor={data.anchor} data={data} onSaved={reload} />
          <CoachHint load={data.yesterdayLoad} />
          <PlannerSection onSession={(s) => setData({ ...data, session: s })} secondary />
        </>
      ) : (
        <>
          <CoachHint load={data.yesterdayLoad} />
          <PlannerSection onSession={(s) => setData({ ...data, session: s })} />
        </>
      )}

      {restKey !== null && <RestTimer key={restKey} onDone={() => setRestKey(null)} />}
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Header: date, streak, weekly ring                                    */
/* ------------------------------------------------------------------ */

function TodayHeader({ data }: { data: TodayResponse }) {
  return (
    <header className="today-head stagger-item" style={st(0)}>
      <div>
        <p className="type-eyebrow today-head__date">Today · {fmtDayEyebrow(data.date)}</p>
        <h1 className="type-display-l today-head__day">Cornerman</h1>
        <p
          className={`type-eyebrow streak-line ${data.streakWeeks > 0 ? '' : 'is-cold'}`}
        >
          {data.streakWeeks > 0 ? `${data.streakWeeks} wk streak` : 'No streak yet'}
        </p>
      </div>
      <Ring value={data.weekSessions} target={data.weeklyTarget} />
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                     */
/* ------------------------------------------------------------------ */

function TodaySkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <div className="today-head">
        <div style={{ flex: 1 }}>
          <Skel h={12} w={140} />
          <Skel h={32} w={200} style={{ marginTop: 8 }} />
          <Skel h={12} w={110} style={{ marginTop: 12 }} />
        </div>
        <Skel h={64} w={64} r="var(--radius-full)" />
      </div>
      <Skel h={220} r="var(--radius-l)" />
      <div className="skel-stack" style={{ marginTop: 'var(--space-6)' }}>
        <Skel h={64} r="var(--radius-m)" />
        <Skel h={64} r="var(--radius-m)" />
        <Skel h={64} r="var(--radius-m)" />
      </div>
    </main>
  )
}
