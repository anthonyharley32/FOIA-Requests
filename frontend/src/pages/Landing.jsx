import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, FileText, PenLine, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/* ---------------------------------------------------------------- */
/*  Motion helpers                                                   */
/* ---------------------------------------------------------------- */

const EASE = [0.76, 0, 0.24, 1]

/**
 * SVG turbulence filter that roughens the redaction strokes so they
 * read as hand-swiped marker ink rather than printed rectangles.
 * Rendered once, invisibly, at the page root.
 */
function MarkerFilter() {
  return (
    <svg aria-hidden className="absolute h-0 w-0">
      <filter id="marker-rough">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.02 0.35"
          numOctaves="3"
          seed="7"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  )
}

/** Streaky, near-opaque ink — faint alpha variation like overlapping marker passes. */
const MARKER_TONES = {
  ink: 'linear-gradient(100deg, rgba(12,12,14,0.97), rgba(12,12,14,1) 16%, rgba(12,12,14,0.96) 38%, rgba(12,12,14,1) 57%, rgba(12,12,14,0.97) 78%, rgba(12,12,14,0.99))',
  crimson:
    'linear-gradient(100deg, rgba(196,30,58,0.97), rgba(196,30,58,1) 16%, rgba(196,30,58,0.96) 38%, rgba(196,30,58,1) 57%, rgba(196,30,58,0.97) 78%, rgba(196,30,58,0.99))',
}

/**
 * Feathered leading edge for the sliding ink: its left side fades from
 * transparent to opaque, so as the ink slides right the text is revealed
 * through a soft fading edge instead of a hard straight cut.
 */
const FEATHER_MASK = 'linear-gradient(to right, transparent 0%, black 22%)'

/**
 * Text that starts hidden under a dark marker-highlight stroke, then the
 * stroke wipes away to reveal the words beneath. The signature motif.
 */
function Unredact({ children, delay = 0, tone = 'ink', inView = false, className = '' }) {
  // The ink is 130% of the stroke's width with 30% hanging off the left,
  // so its feathered left edge starts hidden. Sliding it right (a plain
  // transform, cheap and reliable) sweeps the soft edge across the text
  // while the container clips whatever leaves the stroke's rounded shape.
  const inkMotion = {
    initial: { x: '0%' },
    transition: { delay: delay + 0.1, duration: 0.8, ease: EASE },
    style: {
      left: '-30%',
      width: '130%',
      backgroundImage: MARKER_TONES[tone] ?? MARKER_TONES.ink,
      WebkitMaskImage: FEATHER_MASK,
      maskImage: FEATHER_MASK,
    },
  }
  const anim = { x: '103%' }
  const inkClass = 'absolute inset-y-0'
  return (
    <span className={`relative inline-block whitespace-nowrap ${className}`}>
      {children}
      <span
        aria-hidden
        className="absolute -inset-x-[0.18em] -inset-y-[0.04em] z-10 overflow-hidden"
        style={{
          // Irregular rounded caps, like the start/end of a marker swipe
          borderRadius: '0.5em 0.4em 0.45em 0.55em / 55% 45% 60% 50%',
          filter: 'url(#marker-rough)',
          rotate: '-0.6deg',
        }}
      >
        {inView ? (
          <motion.span
            className={inkClass}
            whileInView={anim}
            viewport={{ once: true, margin: '-80px' }}
            {...inkMotion}
          />
        ) : (
          <motion.span className={inkClass} animate={anim} {...inkMotion} />
        )}
      </span>
    </span>
  )
}

/** Fade-and-rise on scroll into view. */
function Rise({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay, duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Small mono section label, e.g. "SECTION 02 — THE PROCESS". */
function SectionLabel({ children }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.25em] text-crimson">
      {children}
    </p>
  )
}

/* ---------------------------------------------------------------- */
/*  Page sections                                                    */
/* ---------------------------------------------------------------- */

function ClassificationBar() {
  return (
    <div className="bg-ink py-1.5 text-center">
      <p className="font-mono text-[10px] tracking-[0.35em] text-paper/70">
        UNCLASSIFIED&nbsp;&nbsp;//&nbsp;&nbsp;APPROVED FOR PUBLIC RELEASE
      </p>
    </div>
  )
}

function Header({ session }) {
  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="font-display text-2xl tracking-tight text-ink">Unredacted</span>
          <span className="hidden font-mono text-[10px] tracking-[0.2em] text-graphite sm:inline">
            FOIA REQUEST STUDIO
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          {session ? (
            <Link
              to="/dashboard"
              className="group flex items-center gap-2 bg-ink px-4 py-2 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
            >
              OPEN DASHBOARD
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="font-mono text-xs font-medium tracking-wider text-ink underline-offset-4 hover:underline"
              >
                SIGN IN
              </Link>
              <Link
                to="/signup"
                className="group flex items-center gap-2 bg-ink px-4 py-2 font-mono text-xs font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
              >
                GET STARTED
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function DocumentCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, duration: 0.7, ease: EASE }}
      className="relative"
    >
      {/* Stamp */}
      <motion.div
        initial={{ opacity: 0, scale: 1.6, rotate: -4 }}
        animate={{ opacity: 1, scale: 1, rotate: -8 }}
        transition={{ delay: 1.8, duration: 0.25, ease: 'easeOut' }}
        className="absolute -top-5 -right-3 z-10 border-2 border-crimson px-3 py-1.5 sm:-right-6"
        style={{ boxShadow: 'inset 0 0 0 1.5px transparent' }}
      >
        <p className="font-mono text-xs font-medium tracking-[0.3em] text-crimson">
          DECLASSIFIED
        </p>
        <p className="font-mono text-[8px] tracking-[0.2em] text-crimson/80">
          BY AUTHORITY OF THE REQUESTER
        </p>
      </motion.div>

      <div className="border border-ink/15 bg-white p-6 shadow-[8px_8px_0_0_rgba(12,12,14,0.06)] sm:p-8">
        <div className="mb-5 flex items-start justify-between border-b border-ink/10 pb-4">
          <div className="space-y-1 font-mono text-[11px] leading-relaxed text-graphite">
            <p>TO: FOIA OFFICER, FEDERAL AVIATION ADMIN.</p>
            <p>RE: REQUEST UNDER 5 U.S.C. § 552</p>
          </div>
          <FileText className="h-4 w-4 shrink-0 text-ink/30" />
        </div>

        <div className="space-y-3.5 text-[13px] leading-relaxed text-ink/80">
          <p>Pursuant to the Freedom of Information Act, I request copies of:</p>
          <p>
            (1) All <Unredact delay={1.2}>final policy memoranda</Unredact> issued
            by the Office of UAS Integration between{' '}
            <Unredact delay={1.45}>Jan 1, 2024 and Dec 31, 2025</Unredact>{' '}
            concerning waivers under <Unredact delay={1.7}>14 C.F.R. Part 107</Unredact>;
          </p>
          <p className="text-ink/50">
            I request a fee waiver as disclosure is in the public interest…
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
          {['RECORD TYPE ✓', 'DATE RANGE ✓', 'OFFICE ✓', 'CITATION ✓'].map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.1 + i * 0.12 }}
              className="bg-ink/5 px-2 py-1 font-mono text-[9px] tracking-[0.15em] text-graphite"
            >
              {tag}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function Hero({ session }) {
  const primaryTo = session ? '/dashboard' : '/signup'
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(rgba(12,12,14,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-6 font-mono text-[11px] font-medium tracking-[0.25em] text-graphite"
          >
            FILED UNDER: 5 U.S.C. § 552 — FREEDOM OF INFORMATION ACT
          </motion.p>

          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Every government record has a rightful owner.{' '}
            <Unredact delay={0.7} className="italic text-crimson">
              You.
            </Unredact>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-graphite"
          >
            Unredacted turns a plain-English question into a precise, well-scoped FOIA
            request — drafted in minutes, grounded in DOJ guidance, ready to file.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6, ease: EASE }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              to={primaryTo}
              className="group flex items-center gap-3 bg-ink px-7 py-3.5 font-mono text-sm font-medium tracking-wider text-paper transition-colors hover:bg-crimson"
            >
              DRAFT YOUR REQUEST
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#process"
              className="border border-ink/20 px-7 py-3.5 font-mono text-sm font-medium tracking-wider text-ink transition-colors hover:border-ink"
            >
              HOW IT WORKS
            </a>
          </motion.div>
        </div>

        <DocumentCard />
      </div>
    </section>
  )
}

const STATS = [
  { value: '1.7M+', label: 'FOIA requests filed with federal agencies every year' },
  { value: '200K+', label: 'requests sitting in agency backlogs right now' },
  { value: '100+ days', label: 'typical wait for complex requests to be processed' },
  { value: 'Cause № 1', label: 'of delay: vague, overbroad, poorly scoped requests' },
]

function Stats() {
  return (
    <section className="border-y border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Rise>
          <SectionLabel>EXHIBIT A — THE BACKLOG</SectionLabel>
        </Rise>
        <div className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Rise key={stat.value} delay={i * 0.1}>
              <div className="border-t-2 border-ink pt-4">
                <p className="font-display text-4xl text-ink lg:text-5xl">
                  <Unredact inView delay={0.2 + i * 0.15} tone="crimson">
                    {stat.value}
                  </Unredact>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-graphite">{stat.label}</p>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    icon: PenLine,
    num: '01',
    title: 'Describe',
    body: 'Tell us what you’re trying to find out, in plain English. No legal training required — a sentence is enough to start.',
  },
  {
    icon: FileText,
    num: '02',
    title: 'Draft',
    body: 'Our agent drafts a precise, well-scoped request grounded in DOJ FOIA guidance and the patterns of successful filings.',
  },
  {
    icon: Send,
    num: '03',
    title: 'File',
    body: 'Review, refine, and submit through the official agency portal. You keep full control of every word that goes out.',
  },
]

function Process() {
  return (
    <section id="process" className="scroll-mt-8">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Rise>
          <SectionLabel>SECTION 02 — THE PROCESS</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            From rough question to filed request in three moves.
          </h2>
        </Rise>

        <div className="mt-16 grid gap-px overflow-hidden border border-ink/10 bg-ink/10 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <Rise key={step.num} delay={i * 0.12} className="bg-paper">
              <div className="flex h-full flex-col p-8 lg:p-10">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tracking-[0.25em] text-crimson">
                    STEP {step.num}
                  </span>
                  <step.icon className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
                </div>
                <h3 className="mt-6 font-display text-3xl text-ink">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-graphite">{step.body}</p>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  )
}

function BeforeAfter() {
  return (
    <section className="border-y border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Rise>
          <SectionLabel>EXHIBIT B — THE DIFFERENCE</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">
            Agencies can’t answer what they can’t parse.
          </h2>
        </Rise>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          {/* Before */}
          <Rise>
            <div className="flex h-full flex-col border border-ink/15 bg-paper">
              <div className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
                <span className="font-mono text-[11px] tracking-[0.25em] text-graphite">
                  AS RECEIVED
                </span>
                <span className="bg-ink/5 px-2 py-0.5 font-mono text-[10px] tracking-wider text-graphite">
                  LIKELY DELAYED
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6 lg:p-8">
                <p className="font-display text-2xl leading-snug text-ink/70 italic">
                  &ldquo;Send me everything you have about drone programs.&rdquo;
                </p>
                <ul className="mt-8 space-y-2.5 border-t border-ink/10 pt-6 font-mono text-[11px] leading-relaxed tracking-wide text-graphite">
                  <li>✕ NO DATE RANGE — SEARCH IS UNBOUNDED</li>
                  <li>✕ NO OFFICE OR COMPONENT NAMED</li>
                  <li>✕ NO RECORD TYPES SPECIFIED</li>
                  <li>✕ &ldquo;EVERYTHING&rdquo; TRIGGERS OVERBREADTH REVIEW</li>
                </ul>
              </div>
            </div>
          </Rise>

          {/* After */}
          <Rise delay={0.15}>
            <div className="flex h-full flex-col border-2 border-ink bg-paper shadow-[8px_8px_0_0_rgba(196,30,58,0.15)]">
              <div className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
                <span className="font-mono text-[11px] tracking-[0.25em] text-ink">
                  AS UNREDACTED FILES IT
                </span>
                <span className="bg-crimson px-2 py-0.5 font-mono text-[10px] tracking-wider text-paper">
                  ACTIONABLE
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6 lg:p-8">
                <p className="text-[15px] leading-relaxed text-ink/85">
                  &ldquo;I request (1) all final policy memoranda and directives issued by the
                  FAA Office of UAS Integration between January 1, 2024 and December 31,
                  2025 concerning Part 107 waivers; and (2) the three most recent quarterly
                  reports on waiver processing times…&rdquo;
                </p>
                <ul className="mt-8 space-y-2.5 border-t border-ink/10 pt-6 font-mono text-[11px] leading-relaxed tracking-wide text-ink">
                  <li className="text-crimson">✓ BOUNDED DATE RANGE</li>
                  <li className="text-crimson">✓ SPECIFIC OFFICE, SEARCHABLE TERMS</li>
                  <li className="text-crimson">✓ ENUMERATED RECORD TYPES</li>
                  <li className="text-crimson">✓ SEGMENTED FOR PARTIAL RELEASE</li>
                </ul>
              </div>
            </div>
          </Rise>
        </div>
      </div>
    </section>
  )
}

function FinalCta({ session }) {
  const primaryTo = session ? '/dashboard' : '/signup'
  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-28 text-center">
        <Rise>
          <p className="font-mono text-[11px] tracking-[0.3em] text-paper/50">
            SECTION 03 — DISPOSITION
          </p>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[1.08] text-paper sm:text-6xl">
            The file is already yours.{' '}
            <Unredact inView delay={0.5} tone="crimson" className="italic">
              Ask well.
            </Unredact>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-paper/60">
            FOIA gives every citizen the right to ask. Unredacted makes sure the asking
            is precise enough to get an answer.
          </p>
          <div className="mt-12 flex justify-center">
            <Link
              to={primaryTo}
              className="group flex items-center gap-3 bg-paper px-8 py-4 font-mono text-sm font-medium tracking-wider text-ink transition-colors hover:bg-crimson hover:text-paper"
            >
              START YOUR REQUEST
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-paper/10 px-6 py-8 font-mono text-[10px] tracking-[0.2em] text-paper/40 sm:flex-row">
        <p>UNREDACTED — FOIA REQUEST STUDIO</p>
        <p>5 U.S.C. § 552</p>
        <p>BUILT IN AUSTIN, TX FOR AMERICA&rsquo;S 250TH</p>
      </div>
    </footer>
  )
}

/* ---------------------------------------------------------------- */
/*  Page                                                             */
/* ---------------------------------------------------------------- */

export default function Landing() {
  const { session } = useAuth()
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <MarkerFilter />
      <ClassificationBar />
      <Header session={session} />
      <main>
        <Hero session={session} />
        <Stats />
        <Process />
        <BeforeAfter />
      </main>
      <FinalCta session={session} />
      <Footer />
    </div>
  )
}
