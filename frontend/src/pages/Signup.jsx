import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('citizen')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role } },
      })
      if (signUpError) throw signUpError

      // If email confirmation is off, Supabase returns a session immediately
      // and we can go straight into the app. Otherwise, show a "check your
      // inbox" message.
      if (data.session) {
        navigate('/dashboard')
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-sm border border-ink/15 bg-white p-8 text-center shadow-[8px_8px_0_0_rgba(12,12,14,0.06)]">
          <h1 className="mb-2 font-display text-2xl tracking-tight text-ink">Check your email</h1>
          <p className="text-sm text-graphite">
            We sent a confirmation link to <strong>{email}</strong>. Confirm your
            address, then log in.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block bg-ink px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
          >
            GO TO LOGIN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm border border-ink/15 bg-white p-8 shadow-[8px_8px_0_0_rgba(12,12,14,0.06)]">
        <Link to="/" className="font-display text-2xl tracking-tight text-ink">
          Unredacted
        </Link>
        <p className="mt-1 mb-6 font-mono text-[10px] tracking-[0.2em] text-graphite">
          CREATE YOUR ACCOUNT
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">I am a...</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('citizen')}
                className={`border px-3 py-2 text-sm font-medium transition-colors ${
                  role === 'citizen'
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/25 text-ink hover:border-ink'
                }`}
              >
                Citizen requesting records
              </button>
              <button
                type="button"
                onClick={() => setRole('employee')}
                className={`border px-3 py-2 text-sm font-medium transition-colors ${
                  role === 'employee'
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/25 text-ink hover:border-ink'
                }`}
              >
                FOIA employee reviewing requests
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/25 bg-paper/50 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/25 bg-paper/50 px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink px-3 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson disabled:opacity-50"
          >
            {submitting ? 'CREATING ACCOUNT...' : 'SIGN UP'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-graphite">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
