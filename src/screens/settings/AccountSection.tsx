import { useState } from 'react'
import { signOut } from '../../lib/auth'

export function AccountSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const out = async () => {
    setBusy(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.')
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <div className="section__head">
        <h2 className="type-display-m">Account</h2>
      </div>
      <button
        type="button"
        className="btn btn--ghost signout-row"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={() => void out()}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}
