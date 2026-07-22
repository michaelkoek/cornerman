import type { Settings } from '../../../shared/types'

function fmtLastSync(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (diffMin < 60) {
    return `${diffMin} min ago`
  }
  const diffH = Math.round(diffMin / 60)
  if (diffH < 48) {
    return `${diffH}h ago`
  }
  return `${Math.round(diffH / 24)} days ago`
}

export function StravaSection({ settings }: { settings: Settings }) {
  const connected = settings.stravaConnected

  return (
    <section className="section sport-running">
      <div className="section__head">
        <h2 className="type-display-m">Strava</h2>
      </div>
      <div className="card corner-cut corner-bracket">
        <div className="row-between" style={{ paddingLeft: 'var(--space-3)' }}>
          <div className="strava-status">
            <span className={`strava-status__dot ${connected ? 'is-on' : ''}`} />
            {connected ? 'Connected — runs import automatically' : 'Not connected'}
          </div>
        </div>
        <p className="settings-note">
          {connected && settings.stravaLastSyncAt
            ? `Runs sync hourly in the background. Last synced ${fmtLastSync(settings.stravaLastSyncAt)}.`
            : 'Runs sync hourly in the background once authorized — see scripts/strava/authorize.ts.'}
        </p>
      </div>
    </section>
  )
}
