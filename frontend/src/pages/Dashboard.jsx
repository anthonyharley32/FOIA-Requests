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
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEmployee ? 'Review Queue' : 'Your Requests'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEmployee
              ? 'FOIA requests submitted by citizens, awaiting review.'
              : 'Track the status of the records requests you have filed.'}
          </p>
        </div>
        {!isEmployee && profile && (
          <Link
            to="/requests/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            + New Request
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && requests.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
          {isEmployee ? 'No requests in the queue yet.' : 'No requests yet.'}
        </div>
      )}

      <ul className="space-y-3">
        {requests.map((req) => (
          <li key={req.id}>
            <Link
              to={`/requests/${req.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {snippet(req.intent_text) || `Request #${req.id}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
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
