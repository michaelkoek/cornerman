import { useState, type CSSProperties, type FormEvent } from 'react'
import { signInWithEmail, signUpWithEmail } from '../lib/auth'

const st = (i: number) => ({ '--i': i }) as CSSProperties

function friendlyError(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
      return 'Account already exists. Sign in instead.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    default:
      return err instanceof Error ? err.message : 'Sign-in failed. Try again.'
  }
}

/** RINGSIDE-branded sign-in gate. Bold fight-poster card, email/password. */
export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      // On success the auth listener swaps the app in.
    } catch (err) {
      setError(friendlyError(err))
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
        <form onSubmit={(e) => void submit(e)} style={{ width: '100%' }}>
          <input
            type="email"
            className="input"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <input
            type="password"
            className="input"
            placeholder="Password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <button
            type="submit"
            className="btn btn--primary hero__cta login__cta"
            style={{ width: '100%' }}
            disabled={busy}
          >
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ width: '100%', marginTop: '0.5rem' }}
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
        {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  )
}
