import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-baseline gap-3">
          <span className="font-display text-xl tracking-tight text-ink">Unredacted</span>
          <span className="hidden font-mono text-[10px] tracking-[0.2em] text-graphite sm:inline">
            FOIA REQUEST STUDIO
          </span>
        </Link>

        {session && (
          <div className="flex items-center gap-4 text-sm text-graphite">
            {profile && (
              <span className="hidden bg-ink/5 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-graphite sm:inline">
                {profile.role}
              </span>
            )}
            <span className="hidden text-graphite sm:inline">{profile?.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="border border-ink/20 px-3 py-1.5 font-mono text-xs font-medium tracking-wider text-ink transition-colors hover:border-ink"
            >
              SIGN OUT
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
