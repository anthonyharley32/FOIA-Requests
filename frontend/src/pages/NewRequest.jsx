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

function MessageBubble({ message }) {
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
        className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
          isUser
            ? 'bg-slate-900 text-white'
            : 'border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {message.content}
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

  const [suggestedAgency, setSuggestedAgency] = useState(null)
  const [alreadyPublicHint, setAlreadyPublicHint] = useState(null)

  const [inputValue, setInputValue] = useState('')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const textareaRef = useRef(null)

  const started = requestId !== null
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
    setSuggestedAgency(data.suggested_agency ?? null)
    setAlreadyPublicHint(data.already_public_hint ?? null)
  }

  const handleStart = async (text) => {
    const intent = text.trim()
    if (!intent) return
    setError(null)
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
        className="relative flex items-end overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-lg transition-all focus-within:border-slate-300 focus-within:ring-1 focus-within:ring-slate-300"
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
          className="max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent py-4 pl-5 pr-2 text-gray-900 placeholder-gray-400 focus:outline-none"
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
              className="mb-1.5 mr-2 cursor-pointer rounded-full bg-slate-900 p-2.5 text-white transition-colors disabled:opacity-30"
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
    <div className="relative flex h-[calc(100vh-57px)] flex-col bg-slate-50">
      <div className="flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-2xl px-4 pb-6 pt-8 ${isEmptyChat ? '' : 'pb-40'}`}>
          {isEmptyChat ? (
            <div className="flex flex-col items-center pt-[18vh] text-center">
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={springs.standard}>
                <h1 className="mb-2 text-2xl font-semibold text-slate-900">New FOIA Request</h1>
                <p className="mb-8 max-w-md text-sm text-slate-500">
                  Describe what government records you're looking for in plain language. We'll
                  ask clarifying questions until it's specific enough to file.
                </p>
              </motion.div>

              {InputArea}

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

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
                    className="max-w-xs cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-xs text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
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
                  <MessageBubble key={m.id ?? i} message={m} />
                ))}
              </div>

              <AgentStepper active={loading} />

              {suggestedAgency && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={springs.gentle}
                  className="text-xs text-slate-500"
                >
                  <span className="font-medium text-slate-600">Likely agency:</span>{' '}
                  {suggestedAgency}
                </motion.p>
              )}

              {alreadyPublicHint && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  <p className="font-medium">Before filing — this info might already be public</p>
                  <p className="mt-1">{alreadyPublicHint}</p>
                </motion.div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              {ready && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.standard}
                  className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
                >
                  <h2 className="text-sm font-semibold text-slate-900">
                    Review & refine your request
                  </h2>
                  <p className="text-xs text-slate-500">
                    This is the structured FOIA request text that will be submitted. Edit it
                    if needed before submitting.
                  </p>
                  <textarea
                    rows={10}
                    value={finalText}
                    onChange={(e) => setFinalText(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={submitting}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </motion.div>
              )}

              {!ready && (
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={submitting}
                  className="text-sm font-medium text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
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
