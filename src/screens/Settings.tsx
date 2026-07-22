import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { PullToRefresh } from '../components/PullToRefresh'
import { ErrorNotice, Skel } from '../components/Skeleton'
import { AccountSection } from './settings/AccountSection'
import { AnchorsSection } from './settings/AnchorsSection'
import { StravaSection } from './settings/StravaSection'
import { TrainingSection } from './settings/TrainingSection'

export default function Settings() {
  const { data, error, loading, refreshing, reload, setData } = useAsync(api.settings)

  if (loading) return <SettingsSkeleton />
  if (error || !data) {
    return (
      <main className="screen">
        <header className="screen-title">
          <h1 className="type-display-l">Settings</h1>
        </header>
        <ErrorNotice message={error ?? 'Something went wrong.'} onRetry={reload} />
      </main>
    )
  }

  return (
    <main className="screen">
      <PullToRefresh onRefresh={reload} refreshing={refreshing} />
      <header className="screen-title">
        <h1 className="type-display-l">Settings</h1>
      </header>

      <TrainingSection settings={data} setData={setData} />
      <AnchorsSection settings={data} reload={reload} setData={setData} />
      <StravaSection settings={data} />
      <AccountSection />
    </main>
  )
}

/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <header className="screen-title">
        <h1 className="type-display-l">Settings</h1>
      </header>
      <div className="skel-stack">
        <Skel h={80} r="var(--radius-m)" />
        <Skel h={160} r="var(--radius-m)" />
        <Skel h={140} r="var(--radius-l)" />
      </div>
    </main>
  )
}
