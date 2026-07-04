import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AgentStepper from '../components/AgentStepper'
import { springs } from '../lib/animations'

const EXAMPLE_PROMPTS = [
  'Did Lee Harvey Oswald act alone in the assassination of President Kennedy?',
  'Emails from the CHIPS Program Office about delays on the Intel Ohio fab project during 2025.',
  'OSHA inspection reports for a manufacturing plant in Austin, TX filed in the last two years.',
]

// Persist the in-progress conversation for the tab so navigating away (to the
// dashboard, a request, etc.) and back doesn't wipe it. Cleared on submit or
// "Start over". sessionStorage = per-tab, auto-clears when the tab closes.
const STORAGE_KEY = 'unredacted:newrequest'
function loadSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

// Requester-profile autofill: the AI emits these exact tokens in the drafted
// request; we substitute the citizen's saved details in their place.
const TOKEN_MAP = {
  '[FULL_NAME]': 'full_name',
  '[MAILING_ADDRESS]': 'address',
  '[EMAIL]': 'email',
  '[PHONE]': 'phone',
  '[FEE_CATEGORY]': 'requester_category',
  '[FORMAT]': 'format',
}
function fillTokens(text, p) {
  if (!text || !p) return text
  let out = text
  for (const [token, key] of Object.entries(TOKEN_MAP)) {
    if (p[key]) out = out.split(token).join(p[key])
  }
  return out
}
const PROFILE_FIELDS = [
  { key: 'full_name', label: 'Full name', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'address', label: 'Mailing address', type: 'text' },
]
const REQUESTER_CATEGORIES = [
  'Individual / other requester',
  'Representative of the news media',
  'Educational / noncommercial scientific institution',
  'Commercial-use requester',
]
const FORMATS = ['Electronic / PDF', 'Paper copies']

// Renders assistant text, turning [n] markers into small clickable citation
// badges that link to the matching source card / document URL.
function CitationText({ text, citations, onHover }) {
  if (!text) return null
  const parts = text.split(/(\[\d+\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/)
        if (m) {
          const n = Number(m[1])
          const cite = citations?.find((c) => c.n === n)
          return (
            <a
              key={i}
              href={cite?.url || '#'}
              target="_blank"
              rel="noreferrer"
              title={cite?.title || ''}
              onMouseEnter={() => onHover?.(n)}
              onMouseLeave={() => onHover?.(null)}
              className="mx-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-crimson/10 px-1 align-super text-[10px] font-semibold text-crimson no-underline transition-colors hover:bg-crimson/25"
            >
              {n}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MessageBubble({ message, citations, onCiteHover }) {
  const role = message.role || message.sender || 'assistant'
  const isUser = role === 'user' || role === 'citizen'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.standard}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'border border-ink/15 bg-ink/[0.06] text-ink'
            : 'border border-ink/15 bg-white text-ink/80'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <CitationText text={message.content} citations={citations} onHover={onCiteHover} />
        )}
      </div>
    </motion.div>
  )
}

// Horizontally scrollable row of numbered source cards (Perplexity-style).
function CitationCards({ citations, highlight }) {
  if (!citations || citations.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.standard}
      className="space-y-2"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-graphite">
        Sources — public records
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {citations.map((c) => (
          <motion.a
            key={c.n}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            animate={highlight === c.n ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex min-h-[112px] w-56 flex-shrink-0 flex-col rounded-lg border border-ink/15 bg-white p-3 no-underline transition-colors hover:border-crimson"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center bg-ink text-[11px] font-semibold text-paper">
                {c.n}
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-wide text-graphite">
                {c.source}
              </span>
            </div>
            <p className="mb-1 line-clamp-2 text-xs font-medium text-ink">{c.title}</p>
            <p className="line-clamp-3 text-[11px] text-graphite">{c.snippet}</p>
          </motion.a>
        ))}
      </div>
    </motion.div>
  )
}

export default function NewRequest() {
  const { fetchApi, profile } = useAuth()
  const navigate = useNavigate()

  const [profileForm, setProfileForm] = useState({})
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    if (profile?.requester_profile && Object.keys(profile.requester_profile).length) {
      setProfileForm(profile.requester_profile)
    }
  }, [profile])

  const [savedOnce] = useState(loadSaved)

  const [requestId, setRequestId] = useState(savedOnce?.requestId ?? null)
  const [messages, setMessages] = useState(savedOnce?.messages ?? [])
  const [ready, setReady] = useState(savedOnce?.ready ?? false)
  const [finalText, setFinalText] = useState(savedOnce?.finalText ?? '')

  const [mode, setMode] = useState(savedOnce?.mode ?? 'foia')
  const [citations, setCitations] = useState(savedOnce?.citations ?? [])
  const [hoveredCite, setHoveredCite] = useState(null)
  const [suggestedAgency, setSuggestedAgency] = useState(savedOnce?.suggestedAgency ?? null)

  const [inputValue, setInputValue] = useState('')

  const [started, setStarted] = useState(savedOnce?.started ?? false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const textareaRef = useRef(null)

  const isEmptyChat = !started

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  // Persist the conversation so route changes (and returning to this page)
  // don't lose it.
  useEffect(() => {
    if (!started) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const snapshot = { requestId, messages, ready, finalText, mode, citations, suggestedAgency, started }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [requestId, messages, ready, finalText, mode, citations, suggestedAgency, started])

  const handleReset = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setRequestId(null)
    setMessages([])
    setReady(false)
    setFinalText('')
    setMode('foia')
    setCitations([])
    setSuggestedAgency(null)
    setStarted(false)
    setInputValue('')
    setError(null)
  }

  const applyTurnResult = (data) => {
    setMessages(data.messages || [])
    setReady(Boolean(data.ready))
    if (typeof data.final_text === 'string') setFinalText(data.final_text)
    setMode(data.mode || 'foia')
    setCitations(data.citations || [])
    setSuggestedAgency(data.suggested_agency ?? null)
  }

  const handleStart = async (text) => {
    const intent = text.trim()
    if (!intent) return
    setError(null)
    // Optimistically enter the conversation view and show the user's message
    // right away, so the thinking animation plays during the multi-second AI
    // round-trip instead of the page sitting frozen on the empty state.
    setStarted(true)
    setMessages([{ id: 'local-user-0', sender: 'user', content: intent }])
    setLoading(true)
    try {
      const data = await fetchApi('/requests', {
        method: 'POST',
        body: JSON.stringify({ intent_text: intent }),
      })
      setRequestId(data.request.id)
      applyTurnResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (text) => {
    const content = text.trim()
    if (!content) return
    setError(null)
    // Optimistically append the user's reply so it (and the thinking stepper)
    // appear instantly, before the AI round-trip returns the authoritative list.
    setMessages((prev) => [...prev, { id: `local-user-${prev.length}`, sender: 'user', content }])
    setLoading(true)
    try {
      const data = await fetchApi(`/requests/${requestId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      applyTurnResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputSubmit = () => {
    if (!inputValue.trim() || loading) return
    const value = inputValue
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    if (!started) {
      handleStart(value)
    } else {
      handleReply(value)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleInputSubmit()
    }
  }

  const handleExampleClick = (prompt) => {
    if (loading) return
    handleStart(prompt)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard — select the text and copy manually.')
    }
  }

  const handleSaveProfile = async () => {
    setError(null)
    try {
      await fetchApi('/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ requester_profile: profileForm }),
      })
      setProfileSaved(true)
      setFinalText((t) => fillTokens(t, profileForm))
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    }
  }

  // Auto-fill saved details into the drafted request when it becomes ready.
  useEffect(() => {
    if (ready && Object.keys(profileForm).length) {
      setFinalText((t) => fillTokens(t, profileForm))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const handleSubmitRequest = async () => {
    setError(null)
    setSubmitting(true)
    try {
      // Send the (possibly citizen-edited) final text along with submit in
      // case the backend wants to persist edits made during review; it's an
      // additive field on top of the documented no-body contract, so it's
      // safe to include even if the backend ignores it.
      await fetchApi(`/requests/${requestId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ final_text: finalText }),
      })
      sessionStorage.removeItem(STORAGE_KEY)
      navigate(`/requests/${requestId}`)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  // Shared input bar — centered+large before the conversation starts,
  // docks to the bottom of the viewport once it does (via layout animation).
  const InputArea = (
    <motion.div layout="position" layoutId="chat-input" transition={{ type: 'spring', duration: 0.5, bounce: 0.12 }} className="w-full max-w-2xl">
      <motion.div
        layout="position"
        className="relative flex items-end overflow-hidden rounded-3xl border border-ink/20 bg-white shadow-[6px_6px_0_0_rgba(12,12,14,0.06)] transition-all focus-within:border-ink"
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isEmptyChat
              ? 'Describe the records you are looking for...'
              : 'Type your answer...'
          }
          rows={1}
          className="max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent py-4 pl-5 pr-2 text-ink placeholder-graphite/50 focus:outline-none"
        />
        <AnimatePresence>
          {inputValue.trim() && (
            <motion.button
              type="button"
              onClick={handleInputSubmit}
              disabled={loading}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.92 }}
              transition={springs.quick}
              className="mb-1.5 mr-2 cursor-pointer rounded-full bg-ink p-2.5 text-paper transition-colors hover:bg-crimson disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )

  return (
    <div className="relative flex h-[calc(100vh-57px)] flex-col bg-paper">
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-2xl px-4 pb-6 pt-8 ${isEmptyChat ? '' : 'pb-40'}`}>
          {isEmptyChat ? (
            <div className="flex flex-col items-center pt-[18vh] text-center">
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={springs.standard}>
                <h1 className="mb-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">New FOIA Request</h1>
                <p className="mb-8 max-w-md text-sm text-graphite">
                  Describe what government records you're looking for in plain language. We'll
                  ask clarifying questions until it's specific enough to file.
                </p>
              </motion.div>

              {InputArea}

              {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

              <motion.div
                className="mt-6 flex flex-wrap justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...springs.gentle, delay: 0.1 }}
              >
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    onClick={() => handleExampleClick(prompt)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.standard, delay: 0.15 + index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="max-w-xs cursor-pointer rounded-2xl border border-ink/15 bg-white px-4 py-2 text-left text-xs text-graphite transition-colors hover:border-ink/40"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-mono text-[11px] uppercase tracking-wider text-graphite transition-colors hover:text-crimson"
                >
                  ↺ Start over
                </button>
              </div>
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id ?? i}
                    message={m}
                    citations={citations}
                    onCiteHover={setHoveredCite}
                  />
                ))}
              </div>

              <AgentStepper active={loading} />

              {!loading && <CitationCards citations={citations} highlight={hoveredCite} />}

              {mode === 'answer' && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3"
                >
                  <span className="text-xs text-graphite">
                    Need records that aren't in the public set?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleReply(
                        "This is helpful, but I'd still like to file a FOIA request for records on this topic. Please help me draft it.",
                      )
                    }
                    className="rounded-md border border-ink/25 bg-white px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink transition-colors hover:border-crimson hover:text-crimson"
                  >
                    File a FOIA request →
                  </button>
                </motion.div>
              )}

              {suggestedAgency && !ready && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={springs.gentle}
                  className="font-mono text-[11px] tracking-wide text-graphite"
                >
                  <span className="font-medium text-ink">LIKELY AGENCY:</span>{' '}
                  {suggestedAgency}
                </motion.p>
              )}

              {error && <p className="text-sm text-crimson">{error}</p>}

              {ready && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="space-y-4 rounded-lg border border-ink/15 bg-white p-5"
                >
                  <div>
                    <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-graphite">
                      Your FOIA Request Is Ready
                    </h2>
                    <p className="mt-2 text-xs text-graphite">
                      Edit the text below if needed, then file it yourself at FOIA.gov — or
                      submit it through Unredacted to track it here.
                    </p>
                  </div>

                  <div className="rounded-md border border-ink/15 bg-paper/60 p-4">
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-graphite">
                      Your filing details — saved to your account & auto-filled into the request
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PROFILE_FIELDS.map((f) => (
                        <input
                          key={f.key}
                          type={f.type}
                          placeholder={f.label}
                          value={profileForm[f.key] || ''}
                          onChange={(e) =>
                            setProfileForm((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="rounded-md border border-ink/25 bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                        />
                      ))}
                      <select
                        value={profileForm.requester_category || ''}
                        onChange={(e) =>
                          setProfileForm((p) => ({ ...p, requester_category: e.target.value }))
                        }
                        className="rounded-md border border-ink/25 bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                      >
                        <option value="">Requester category…</option>
                        {REQUESTER_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={profileForm.format || ''}
                        onChange={(e) =>
                          setProfileForm((p) => ({ ...p, format: e.target.value }))
                        }
                        className="rounded-md border border-ink/25 bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                      >
                        <option value="">Preferred format…</option>
                        {FORMATS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="mt-3 rounded-md bg-ink px-4 py-2 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
                    >
                      {profileSaved ? 'SAVED ✓ — FILLED INTO REQUEST' : 'SAVE & AUTOFILL'}
                    </button>
                  </div>

                  <textarea
                    rows={12}
                    value={finalText}
                    onChange={(e) => setFinalText(e.target.value)}
                    className="w-full rounded-md border border-ink/25 bg-paper/50 px-3 py-2 font-mono text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  />

                  {suggestedAgency && (
                    <div className="rounded-md border border-ink/15 bg-paper/60 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-graphite">
                        Where to file
                      </p>
                      <p className="mt-1 text-sm text-ink">{suggestedAgency}</p>
                      <p className="mt-1 text-xs text-graphite">
                        Most federal requests can be filed through the national portal at FOIA.gov.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="rounded-md bg-ink px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
                    >
                      {copied ? 'COPIED ✓' : 'COPY REQUEST'}
                    </button>
                    <a
                      href="https://www.foia.gov/agency-search.html"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-ink/25 px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-ink no-underline transition-colors hover:border-crimson hover:text-crimson"
                    >
                      FILE AT FOIA.GOV ↗
                    </a>
                    <button
                      type="button"
                      onClick={handleSubmitRequest}
                      disabled={submitting}
                      className="text-xs font-medium text-graphite/70 underline underline-offset-4 hover:text-ink disabled:opacity-50"
                    >
                      {submitting ? 'Submitting…' : 'Or submit through Unredacted →'}
                    </button>
                  </div>
                </motion.div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Input docked to bottom once the conversation has started (hidden once ready for final review) */}
      {!isEmptyChat && !ready && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-4 pb-6">
          <div className="pointer-events-auto mx-auto flex max-w-2xl justify-center">
            {InputArea}
          </div>
        </div>
      )}
    </div>
  )
}
