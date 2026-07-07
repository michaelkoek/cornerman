import { useState, type CSSProperties } from 'react'
import { signInWithGoogle } from '../lib/auth'

const st = (i: number) => ({ '--i': i }) as CSSProperties

/** RINGSIDE-branded sign-in gate. Bold fight-poster card, one red CTA. */
export default function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // On popup success the auth listener swaps the app in.
      // On redirect this navigates away, so we won't reach here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="screen login">
      <section
        className="card card--hero corner-cut corner-bracket sport-kickboxing stagger-item login__card"
        style={st(0)}
      >
        <div className="hero__eyebrow-row">
          <span className="type-eyebrow">In your corner</span>
        </div>
        <h1 className="type-display-xl hero__name login__title">Cornerman</h1>
        <p className="hero__meta">Plan the session · log the work · watch the numbers climb</p>
        <p className="coach-line login__quip">Hands up. Let’s get to work.</p>
        <button
          type="button"
          className="btn btn--primary hero__cta login__cta"
          style={{ width: '100%' }}
          disabled={busy}
          onClick={() => void signIn()}
        >
          {busy ? 'Opening…' : 'Sign in with Google'}
        </button>
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  )
}
