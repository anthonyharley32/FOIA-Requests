import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'

/** Mono, tracked-out card heading in the dossier style. */
function CardLabel({ children }) {
  return (
    <h2 className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-graphite">
      {children}
    </h2>
  )
}

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
  const [copied, setCopied] = useState(false)
  const [showThread, setShowThread] = useState(false)
  const fileInputRef = useRef(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(request?.final_text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore — user can select and copy manually */
    }
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchApi(`/requests/${id}`)
      setRequest(data.request)
      setMessages(data.messages || [])
      setDocuments(data.documents || [])
      // Answer-only chats (no drafted request yet) have nothing but the
      // conversation, so show it expanded; drafted requests stay collapsed.
      setShowThread(!data.request?.final_text)
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
    return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-graphite">Loading...</div>
  }

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-8 text-sm text-crimson">{error}</div>
  }

  if (!request) return null

  const isEmployee = role === 'employee'
  const isFulfilled = request.status === 'fulfilled'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-ink">
            Request #{request.id}
          </h1>
          <p className="mt-1 font-mono text-[11px] tracking-wide text-graphite/80">
            {request.created_at ? new Date(request.created_at).toLocaleString() : ''}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {request.final_text && (
        <div className="mb-6 rounded-lg border border-ink/15 bg-white p-5">
          <CardLabel>Request Text</CardLabel>
          <pre className="whitespace-pre-wrap font-mono text-sm text-ink/80">
            {request.final_text}
          </pre>
          {!isEmployee && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-ink px-4 py-2 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
              >
                {copied ? 'COPIED ✓' : 'COPY REQUEST'}
              </button>
              <a
                href="https://www.foia.gov/agency-search.html"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-ink/25 px-4 py-2 font-mono text-xs font-medium tracking-wider text-ink no-underline transition-colors hover:border-crimson hover:text-crimson"
              >
                FILE AT FOIA.GOV ↗
              </a>
            </div>
          )}
        </div>
      )}

      {!isEmployee && messages.length > 0 && (
        <div className="mb-6 rounded-lg border border-ink/15 bg-white p-5">
          <button
            type="button"
            onClick={() => setShowThread((s) => !s)}
            className="flex w-full items-center justify-between"
          >
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-graphite">
              How this request was scoped
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-graphite/70">
              {showThread ? 'Hide' : `Show conversation (${messages.length})`}
            </span>
          </button>
          {showThread && (
            <div className="mt-4 space-y-2">
              {messages.map((m, i) => {
                const r = m.role || m.sender || 'assistant'
                const isUser = r === 'user' || r === 'citizen'
                return (
                  <div key={m.id ?? i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        isUser ? 'border border-ink/15 bg-ink/[0.06] text-ink' : 'border border-ink/15 bg-paper text-ink/80'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Citizen view */}
      {!isEmployee && (
        <div className="border border-ink/15 bg-white p-5">
          <CardLabel>Documents</CardLabel>
          {isFulfilled ? (
            documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between border border-ink/15 px-3 py-2 text-sm">
                    <span className="truncate text-ink/80">{doc.filename || doc.name || `Document #${doc.id}`}</span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ink underline underline-offset-4"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite">Marked fulfilled, but no documents were attached.</p>
            )
          ) : (
            <p className="text-sm text-graphite">
              Your request is currently <strong>{request.status}</strong>. Documents will appear
              here once it's fulfilled.
            </p>
          )}
        </div>
      )}

      {/* Employee view */}
      {isEmployee && (
        <div className="space-y-4">
          <div className="rounded-lg border border-ink/15 bg-white p-5">
            <CardLabel>Existing Documents</CardLabel>
            {documents.length === 0 ? (
              <p className="text-sm text-graphite">No documents attached yet.</p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between border border-ink/15 px-3 py-2 text-sm">
                    <span className="truncate text-ink/80">{doc.filename || doc.name || `Document #${doc.id}`}</span>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-4">
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isFulfilled && (
            <div className="rounded-lg border border-ink/15 bg-white p-5">
              <CardLabel>Attach Responsive Document</CardLabel>
              <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-graphite"
                />
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="bg-ink px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson disabled:opacity-50"
                >
                  {uploading ? 'UPLOADING...' : 'ATTACH DOCUMENT'}
                </button>
              </form>
            </div>
          )}

          {actionError && <p className="text-sm text-crimson">{actionError}</p>}

          {!isFulfilled && (
            <button
              type="button"
              onClick={handleFulfill}
              disabled={fulfilling}
              className="bg-emerald-700 px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
            >
              {fulfilling ? 'MARKING FULFILLED...' : 'MARK FULFILLED'}
            </button>
          )}
          {isFulfilled && (
            <p className="font-mono text-xs font-medium tracking-wider text-emerald-700">
              THIS REQUEST HAS BEEN FULFILLED.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
