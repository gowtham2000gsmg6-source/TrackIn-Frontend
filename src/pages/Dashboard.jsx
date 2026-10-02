import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bluetooth, BluetoothOff, Users, LogIn, LogOut as LogOutIcon, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getDashboard, checkOut, admitVisitor } from '../api/visitors'
import { apiErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge.jsx'

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="border border-white/10 bg-[#0D1521] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs tracking-wide text-white/45 uppercase">{label}</span>
        <Icon size={16} className="text-brass-400" strokeWidth={1.75} />
      </div>
      <p className="font-display text-4xl text-brass-50">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await getDashboard()
      setData(d)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load dashboard'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const handleCheckOut = async (visitorId) => {
    setBusyId(visitorId)
    try {
      await checkOut(visitorId)
      toast.success(`${visitorId} checked out`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Check-out failed'))
    } finally {
      setBusyId(null)
    }
  }

  const handleAdmit = async (visitorId) => {
    setBusyId(visitorId)
    try {
      await admitVisitor(visitorId)
      toast.success(`${visitorId} admitted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Admit failed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading dashboard…
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-brass-50">Gate Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Live view of today's campus visitor traffic</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Total Visitors Today" value={data?.total_visitors ?? 0} icon={Users} />
        <StatCard label="Currently On Campus" value={data?.visitors_inside ?? 0} icon={LogIn} />
        <StatCard label="Checked Out Today" value={data?.visitors_exited ?? 0} icon={LogOutIcon} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-brass-50">On Campus Right Now</h2>
        <Link to="/active" className="text-xs text-brass-400 hover:text-brass-300">View all →</Link>
      </div>

      <div className="border border-white/10 divide-y divide-white/10">
        {data?.live_visitors?.length ? (
          data.live_visitors.map((v) => (
            <div key={v.visitor_id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]">
              <div className="min-w-0">
                <p className="text-sm text-brass-50 truncate">{v.full_name}</p>
                <p className="text-xs text-white/40 font-mono">{v.visitor_id} · {v.department}</p>
                {v.bluetooth_device_name && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    v.bluetooth_device_active ? 'text-signal-green' : 'text-signal-amber'
                  }`}>
                    {v.bluetooth_device_active ? <Bluetooth size={12} /> : <BluetoothOff size={12} />}
                    {v.bluetooth_device_name} · {v.bluetooth_device_active ? 'connected' : 'last seen'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={v.status} />
                {v.status === 'Pending Entry' ? (
                  <button
                    onClick={() => handleAdmit(v.visitor_id)}
                    disabled={busyId === v.visitor_id}
                    className="text-xs text-signal-green border border-signal-green/30 hover:bg-signal-green/10 px-3 py-1.5 disabled:opacity-40"
                  >
                    {busyId === v.visitor_id ? 'Working…' : 'Admit'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckOut(v.visitor_id)}
                    disabled={busyId === v.visitor_id}
                    className="text-xs text-signal-red border border-signal-red/30 hover:bg-signal-red/10 px-3 py-1.5 disabled:opacity-40"
                  >
                    {busyId === v.visitor_id ? 'Working…' : 'Check Out'}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-8 text-center text-sm text-white/35">No one on campus right now.</p>
        )}
      </div>
    </div>
  )
}
