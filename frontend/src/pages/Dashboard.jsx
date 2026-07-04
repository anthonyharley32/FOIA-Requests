import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'

function snippet(text, max = 120) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export default function Dashboard() {
  const { fetchApi, role, profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchApi('/requests')
      .then((data) => {
        if (!cancelled) setRequests(data.requests || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchApi])

  const isEmployee = role === 'employee'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            {isEmployee ? 'Review Queue' : 'Your Requests'}
          </h1>
          <p className="mt-1 text-sm text-graphite">
            {isEmployee
              ? 'FOIA requests submitted by citizens, awaiting review.'
              : 'Track the status of the records requests you have filed.'}
          </p>
        </div>
        {!isEmployee && profile && (
          <Link
            to="/requests/new"
            className="bg-ink px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
          >
            + NEW REQUEST
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-graphite">Loading...</p>}
      {error && <p className="text-sm text-crimson">{error}</p>}

      {!loading && !error && requests.length === 0 && (
        <div className="border border-dashed border-ink/25 py-12 text-center font-mono text-xs tracking-wider text-graphite">
          {isEmployee ? 'NO REQUESTS IN THE QUEUE YET.' : 'NO REQUESTS ON FILE YET.'}
        </div>
      )}

      <ul className="space-y-3">
        {requests.map((req) => (
          <li key={req.id}>
            <Link
              to={`/requests/${req.id}`}
              className="block border border-ink/15 bg-white p-4 transition-colors hover:border-ink/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {snippet(req.intent_text) || `Request #${req.id}`}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wide text-graphite/80">
                    {req.created_at ? new Date(req.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
