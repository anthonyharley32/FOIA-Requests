const STYLES = {
  clarifying: 'bg-amber-100 text-amber-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  fulfilled: 'bg-green-100 text-green-800',
}

const LABELS = {
  clarifying: 'Clarifying',
  submitted: 'Submitted',
  under_review: 'Under Review',
  fulfilled: 'Fulfilled',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || 'bg-slate-100 text-slate-700'
  const label = LABELS[status] || status

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  )
}
