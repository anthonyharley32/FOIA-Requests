import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Landmark, FileText, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react'
import { springs } from '../lib/animations'

// Lightweight *simulated* progress UI shown while waiting for an AI turn
// (POST /requests or /requests/:id/reply). These are not real backend
// tool-call events — just labels that advance on a timer to make the wait
// feel transparent. Adapted from a sibling project's ToolCallStepper pattern.
const STEPS = [
  { icon: Search, label: 'Checking if this is already public record...' },
  { icon: Landmark, label: 'Identifying the likely agency...' },
  { icon: FileText, label: 'Drafting your request...' },
]

export default function AgentStepper({ active }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const wasActive = useRef(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setExpanded(true)
      setCurrentStep(0)
      wasActive.current = true

      const interval = setInterval(() => {
        setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
      }, 850)
      return () => clearInterval(interval)
    }

    if (wasActive.current) {
      wasActive.current = false
      // Mirror the reference component: auto-collapse shortly after the
      // real content arrives, then fade the whole stepper out.
      const collapseTimer = setTimeout(() => setExpanded(false), 400)
      const hideTimer = setTimeout(() => setVisible(false), 1000)
      return () => {
        clearTimeout(collapseTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [active])

  if (!visible) return null

  const allDone = !active
  const visibleSteps = STEPS.slice(0, currentStep + 1)
  const headerLabel = allDone ? 'Done thinking' : STEPS[currentStep].label

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={springs.gentle}
        className="mb-3"
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full cursor-pointer items-center gap-2.5 border border-ink/15 bg-white px-3 py-2 text-left transition-colors hover:border-ink/40"
        >
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full">
            {allDone ? (
              <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
            ) : (
              <Loader2 className="h-[18px] w-[18px] animate-spin text-graphite/60" />
            )}
          </div>
          <span className="flex-1 text-xs font-medium text-graphite">{headerLabel}</span>
          <div className="text-graphite/60">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { type: 'spring', duration: 0.35, bounce: 0.05 },
                opacity: { duration: 0.2 },
              }}
              className="overflow-hidden"
            >
              <div className="relative ml-3 mt-2 pl-6 before:absolute before:bottom-1 before:left-[11.5px] before:top-1 before:w-[1.5px] before:bg-ink/10">
                <AnimatePresence initial={false}>
                  {visibleSteps.map((step, i) => {
                    const Icon = step.icon
                    const isDone = allDone || i < currentStep
                    return (
                      <motion.div
                        key={step.label}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        transition={{
                          height: { type: 'spring', duration: 0.35, bounce: 0.05 },
                          opacity: { duration: 0.2, delay: 0.05 },
                        }}
                        className="overflow-hidden"
                      >
                        <div className="relative flex items-center gap-2.5 py-1">
                          <div
                            className={`absolute -left-[19.5px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-paper transition-colors duration-300 ${
                              isDone ? 'bg-emerald-500' : 'bg-graphite/70'
                            }`}
                          >
                            <Icon className="h-2 w-2 text-white" />
                          </div>
                          <span className="truncate text-xs text-graphite">{step.label}</span>
                          {!isDone && (
                            <Loader2 className="ml-auto h-3 w-3 flex-shrink-0 animate-spin text-graphite/60" />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
