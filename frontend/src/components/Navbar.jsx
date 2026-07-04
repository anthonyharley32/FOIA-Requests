import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserRound, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b border-ink/10 bg-paper">
      <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-baseline">
          <span className="font-display text-3xl tracking-tight text-ink">Unredacted</span>
        </Link>
        <span className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-graphite sm:inline">
          FOIA REQUEST STUDIO
        </span>

        {session && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 border border-ink/20 px-3 py-1.5 font-mono text-xs font-medium tracking-wider text-ink transition-colors hover:border-ink"
            >
              <UserRound className="h-3.5 w-3.5" />
              ACCOUNT
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 z-20 mt-2 w-64 border border-ink/15 bg-white shadow-[6px_6px_0_0_rgba(12,12,14,0.08)]">
                <div className="border-b border-ink/10 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-graphite">
                    {profile?.role || 'account'}
                  </p>
                  <p className="mt-1 truncate text-sm text-ink">{profile?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 text-left font-mono text-xs font-medium tracking-wider text-ink transition-colors hover:bg-ink hover:text-paper"
                >
                  SIGN OUT
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
