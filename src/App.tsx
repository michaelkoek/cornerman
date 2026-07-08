import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { Skel } from './components/Skeleton'
import { useAuth } from './lib/auth'
import { usePwaAutoUpdate } from './lib/pwaUpdate'
import Log from './screens/Log'
import Login from './screens/Login'
import Settings from './screens/Settings'
import Today from './screens/Today'

// recharts is heavy — split it off the critical gym path
const Progress = lazy(() => import('./screens/Progress'))

function ProgressFallback() {
  return (
    <main className="screen" aria-busy="true">
      <header className="screen-title">
        <h1 className="type-display-l">Progress</h1>
      </header>
      <Skel h={96} r="var(--radius-m)" />
      <Skel h={252} r="var(--radius-m)" style={{ marginTop: 'var(--space-8)' }} />
    </main>
  )
}

function Screens() {
  const location = useLocation()
  return (
    // key on pathname re-runs the screen entrance (fade/rise, no exit — DESIGN §6)
    <div key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Today />} />
        <Route path="/log" element={<Log />} />
        <Route
          path="/progress"
          element={
            <Suspense fallback={<ProgressFallback />}>
              <Progress />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function Splash() {
  return (
    <main className="splash">
      <span className="splash__mark">Cornerman</span>
      <span className="splash__spinner" aria-label="Loading" />
    </main>
  )
}

function ConfigError() {
  return (
    <main className="config-error">
      <h1 className="type-display-l">Not configured</h1>
      <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
        Firebase isn’t set up. Add the VITE_FIREBASE_* values (see .env.example) and reload.
      </p>
    </main>
  )
}

export default function App() {
  usePwaAutoUpdate()
  const { user, loading, configured } = useAuth()

  let content: React.ReactNode
  if (!configured) {
    content = <ConfigError />
  } else if (loading) {
    content = <Splash />
  } else if (!user) {
    content = <Login />
  } else {
    content = (
      <>
        <Screens />
        <TabBar />
      </>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="app-grain">{content}</div>
    </BrowserRouter>
  )
}
