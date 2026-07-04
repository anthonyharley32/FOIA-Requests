import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'

export default function RequestDetail() {
  const { id } = useParams()
  const { fetchApi, role } = useAuth()

  const [request, setRequest] = useState(null)
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fulfilling, setFulfilling] = useState(false)
  const [actionError, setActionError] = useState(null)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchApi(`/requests/${id}`)
      setRequest(data.request)
      setMessages(data.messages || [])
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchApi, id])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setActionError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await fetchApi(`/requests/${id}/documents`, {
        method: 'POST',
        body: form,
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleFulfill = async () => {
    setActionError(null)
    setFulfilling(true)
    try {
      await fetchApi(`/requests/${id}/fulfill`, { method: 'POST' })
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setFulfilling(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-slate-500">Loading...</div>
  }

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-red-600">{error}</div>
  }

  if (!request) return null

  const isEmployee = role === 'employee'
  const isFulfilled = request.status === 'fulfilled'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Request #{request.id}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {request.created_at ? new Date(request.created_at).toLocaleString() : ''}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.final_text && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Request Text</h2>
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700">
            {request.final_text}
          </pre>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Message Thread</h2>
        <div className="space-y-2">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">No messages.</p>
          )}
          {messages.map((m, i) => {
            const r = m.role || m.sender || 'assistant'
            const isUser = r === 'user' || r === 'citizen'
            return (
              <div key={m.id ?? i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Citizen view */}
      {!isEmployee && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Documents</h2>
          {isFulfilled ? (
            documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700">{doc.filename || doc.name || `Document #${doc.id}`}</span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Marked fulfilled, but no documents were attached.</p>
            )
          ) : (
            <p className="text-sm text-slate-500">
              Your request is currently <strong>{request.status}</strong>. Documents will appear
              here once it's fulfilled.
            </p>
          )}
        </div>
      )}

      {/* Employee view */}
      {isEmployee && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Existing Documents</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents attached yet.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span className="truncate text-slate-700">{doc.filename || doc.name || `Document #${doc.id}`}</span>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-slate-900 underline">
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isFulfilled && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Attach Responsive Document</h2>
              <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-slate-600"
                />
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Attach Document'}
                </button>
              </form>
            </div>
          )}

          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          {!isFulfilled && (
            <button
              type="button"
              onClick={handleFulfill}
              disabled={fulfilling}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {fulfilling ? 'Marking fulfilled...' : 'Mark Fulfilled'}
            </button>
          )}
          {isFulfilled && (
            <p className="text-sm font-medium text-green-700">This request has been fulfilled.</p>
          )}
        </div>
      )}
    </div>
  )
}
