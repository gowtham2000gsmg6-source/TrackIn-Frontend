import React, { useEffect, useState, useCallback } from 'react'
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getHistory } from '../api/visitors'
import { apiErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge.jsx'

const PAGE_SIZE = 15

function toCsv(rows) {
  const header = ['Visitor ID', 'Name', 'Phone', 'Department', 'Person to Meet', 'Purpose', 'Entry Time', 'Exit Time', 'Status']
  const lines = rows.map((v) => [
    v.visitor_id, v.full_name, v.phone_number, v.department, v.person_to_meet, v.purpose,
    v.entry_time, v.exit_time || '', v.status,
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
  return [header.join(','), ...lines].join('\n')
}

export default function History() {
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (search.trim()) params.search = search.trim()
      if (startDate) params.start_date = new Date(startDate).toISOString()
      if (endDate) params.end_date = new Date(endDate + 'T23:59:59').toISOString()
      const data = await getHistory(params)
      setVisitors(data)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load visitor log'))
    } finally {
      setLoading(false)
    }
  }, [page, search, startDate, endDate])

  useEffect(() => { load() }, [load])

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  const handleExport = () => {
    if (!visitors.length) {
      toast.error('Nothing to export on this page')
      return
    }
    const blob = new Blob([toCsv(visitors)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcet-visitor-log-page-${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-brass-50">Visitor Log</h1>
          <p className="text-sm text-white/40 mt-1">Full history with date range and search filters</p>
        </div>
        <button onClick={handleExport} className="btn-ghost text-xs">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4 mb-6 border border-white/10 bg-[#0D1521] p-4">
        <div>
          <label className="ledger-label">From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ledger-input" />
        </div>
        <div>
          <label className="ledger-label">To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ledger-input" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="ledger-label">Search name or phone</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="ledger-input" placeholder="e.g. Rajesh or 98765…" />
        </div>
        <button type="submit" className="btn-primary">Apply Filters</button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-white/40">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading…
        </div>
      ) : (
        <>
          <div className="border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-white/40 border-b border-white/10">
                  <th className="px-4 py-3 font-normal">Visitor</th>
                  <th className="px-4 py-3 font-normal">Department</th>
                  <th className="px-4 py-3 font-normal">Purpose</th>
                  <th className="px-4 py-3 font-normal">Entry</th>
                  <th className="px-4 py-3 font-normal">Exit</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {visitors.map((v) => (
                  <tr key={v.visitor_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-brass-50">{v.full_name}</p>
                      <p className="text-xs text-white/35 font-mono">{v.visitor_id} · {v.phone_number}</p>
                    </td>
                    <td className="px-4 py-3 text-white/70">{v.department}</td>
                    <td className="px-4 py-3 text-white/70">{v.purpose}</td>
                    <td className="px-4 py-3 text-white/60 font-mono text-xs">{new Date(v.entry_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-white/60 font-mono text-xs">
                      {v.exit_time ? new Date(v.exit_time).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-white/35">No visits match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost text-xs disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-white/40 font-mono">Page {page}</span>
            <button
              onClick={() => setPage((p) => (visitors.length < PAGE_SIZE ? p : p + 1))}
              disabled={visitors.length < PAGE_SIZE}
              className="btn-ghost text-xs disabled:opacity-30"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
