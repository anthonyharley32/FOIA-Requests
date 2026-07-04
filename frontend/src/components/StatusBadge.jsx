const STYLES = {
  clarifying: 'border-amber-300 bg-amber-50 text-amber-900',
  submitted: 'border-ink/20 bg-ink/5 text-ink',
  under_review: 'border-crimson/30 bg-crimson/10 text-crimson',
  fulfilled: 'border-emerald-300 bg-emerald-50 text-emerald-800',
}

const LABELS = {
  clarifying: 'Clarifying',
  submitted: 'Submitted',
  under_review: 'Under Review',
  fulfilled: 'Fulfilled',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'border-ink/20 bg-ink/5 text-graphite'
  const label = LABELS[status] || status

  return (
    <span
      className={`inline-block border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.15em] ${style}`}
    >
      {label}
    </span>
  )
}
