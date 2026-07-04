import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AgentStepper from '../components/AgentStepper'
import { springs } from '../lib/animations'

const EXAMPLE_PROMPTS = [
  'Emails from the CHIPS Program Office about delays on the Intel Ohio fab project during 2025.',
  'OSHA inspection reports for a manufacturing plant in Austin, TX filed in the last two years.',
  'Correspondence between the EPA and a local utility regarding water permit violations.',
]

// Renders assistant text, turning [n] markers into small clickable citation
// badges that link to the matching source card / document URL.
function CitationText({ text, citations }) {
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

function MessageBubble({ message, citations }) {
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
        className={`max-w-[85%] px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-ink text-paper'
            : 'border border-ink/15 bg-white text-ink/80'
        }`}
      >
        {isUser ? message.content : <CitationText text={message.content} citations={citations} />}
      </div>
    </motion.div>
  )
}

// Horizontally scrollable row of numbered source cards (Perplexity-style).
function CitationCards({ citations }) {
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
          <a
            key={c.n}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[112px] w-56 flex-shrink-0 flex-col border border-ink/15 bg-white p-3 no-underline transition-colors hover:border-crimson"
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
          </a>
        ))}
      </div>
    </motion.div>
  )
}

export default function NewRequest() {
  const { fetchApi } = useAuth()
  const navigate = useNavigate()

  const [requestId, setRequestId] = useState(null)
  const [messages, setMessages] = useState([])
  const [ready, setReady] = useState(false)
  const [finalText, setFinalText] = useState('')

  const [mode, setMode] = useState('foia')
  const [citations, setCitations] = useState([])
  const [suggestedAgency, setSuggestedAgency] = useState(null)
  const [alreadyPublicHint, setAlreadyPublicHint] = useState(null)

  const [inputValue, setInputValue] = useState('')

  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const textareaRef = useRef(null)

  const isEmptyChat = !started

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  const applyTurnResult = (data) => {
    setMessages(data.messages || [])
    setReady(Boolean(data.ready))
    if (typeof data.final_text === 'string') setFinalText(data.final_text)
    setMode(data.mode || 'foia')
    setCitations(data.citations || [])
    setSuggestedAgency(data.suggested_agency ?? null)
    setAlreadyPublicHint(data.already_public_hint ?? null)
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
        className="relative flex items-end overflow-hidden border border-ink/20 bg-white shadow-[6px_6px_0_0_rgba(12,12,14,0.06)] transition-all focus-within:border-ink"
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
              className="mb-1.5 mr-2 cursor-pointer bg-ink p-2.5 text-paper transition-colors hover:bg-crimson disabled:opacity-30"
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
                <h1 className="mb-2 font-display text-3xl tracking-tight text-ink">New FOIA Request</h1>
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
                    className="max-w-xs cursor-pointer border border-ink/15 bg-white px-4 py-2 text-left text-xs text-graphite transition-colors hover:border-ink/40"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <MessageBubble key={m.id ?? i} message={m} citations={citations} />
                ))}
              </div>

              <AgentStepper active={loading} />

              {!loading && <CitationCards citations={citations} />}

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
                    className="border border-ink/25 bg-white px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink transition-colors hover:border-crimson hover:text-crimson"
                  >
                    File a FOIA request →
                  </button>
                </motion.div>
              )}

              {suggestedAgency && (
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

              {alreadyPublicHint && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  <p className="font-medium">Before filing — this info might already be public</p>
                  <p className="mt-1">{alreadyPublicHint}</p>
                </motion.div>
              )}

              {error && <p className="text-sm text-crimson">{error}</p>}

              {ready && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="space-y-3 border border-ink/15 bg-white p-5"
                >
                  <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-graphite">
                    Review & Refine Your Request
                  </h2>
                  <p className="text-xs text-graphite">
                    This is the structured FOIA request text that will be submitted. Edit it
                    if needed before submitting.
                  </p>
                  <textarea
                    rows={10}
                    value={finalText}
                    onChange={(e) => setFinalText(e.target.value)}
                    className="w-full border border-ink/25 bg-paper/50 px-3 py-2 font-mono text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={submitting}
                    className="bg-ink px-4 py-2.5 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson disabled:opacity-50"
                  >
                    {submitting ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
                  </button>
                </motion.div>
              )}

              {!ready && (
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={submitting}
                  className="text-sm font-medium text-graphite/70 underline underline-offset-4 hover:text-ink disabled:opacity-50"
                >
                  Submit anyway
                </button>
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
