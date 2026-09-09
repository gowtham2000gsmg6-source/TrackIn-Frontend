import React from 'react'

const STYLES = {
  Inside: 'text-signal-green border-signal-green/40 bg-signal-green/10',
  'Pending Entry': 'text-signal-amber border-signal-amber/40 bg-signal-amber/10',
  'Pending Exit': 'text-signal-amber border-signal-amber/40 bg-signal-amber/10',
  Exited: 'text-white/40 border-white/15 bg-white/[0.03]',
}

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.Exited
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs border font-mono ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}
