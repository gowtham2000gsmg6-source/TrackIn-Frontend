import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Loader2, Search, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getActive, checkOut } from '../api/visitors'
import { apiErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Active() {
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getActive()
      setVisitors(data)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load active visitors'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return visitors
    return visitors.filter(
      (v) =>
        v.full_name.toLowerCase().includes(q) ||
        v.phone_number.includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.visitor_id.toLowerCase().includes(q)
    )
  }, [visitors, query])

  const handleCheckOut = async (visitorId) => {
    setBusyId(visitorId)
    try {
      await checkOut(visitorId)
      toast.success(`${visitorId} checked out`)
      setVisitors((v) => v.filter((x) => x.visitor_id !== visitorId))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Check-out failed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-brass-50">On Campus</h1>
          <p className="text-sm text-white/40 mt-1">{visitors.length} visitor{visitors.length !== 1 ? 's' : ''} currently inside</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-0 top-3 text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, department, ID…"
          className="ledger-input pl-6"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-white/40">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading…
        </div>
      ) : (
        <div className="border border-white/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-white/40 border-b border-white/10">
                <th className="px-4 py-3 font-normal">Visitor</th>
                <th className="px-4 py-3 font-normal">Phone</th>
                <th className="px-4 py-3 font-normal">Department</th>
                <th className="px-4 py-3 font-normal">Purpose</th>
                <th className="px-4 py-3 font-normal">Entry Time</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((v) => (
                <tr key={v.visitor_id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-brass-50">{v.full_name}</p>
                    <p className="text-xs text-white/35 font-mono">{v.visitor_id}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70 font-mono">{v.phone_number}</td>
                  <td className="px-4 py-3 text-white/70">{v.department}</td>
                  <td className="px-4 py-3 text-white/70">{v.purpose}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">
                    {new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleCheckOut(v.visitor_id)}
                      disabled={busyId === v.visitor_id}
                      className="text-xs text-signal-red border border-signal-red/30 hover:bg-signal-red/10 px-3 py-1.5 disabled:opacity-40"
                    >
                      {busyId === v.visitor_id ? 'Working…' : 'Check Out'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/35">No matching visitors on campus.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
