import React, { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut, MapPin, Radio, ShieldAlert, ShieldCheck, Wifi } from 'lucide-react'
import { getReceiver, receiverHeartbeat } from '../api/receivers'
import { apiErrorMessage, parseApiTimestamp } from '../api/client'

export function ReceiverGuard({ children }) {
  return sessionStorage.getItem('mcet_receiver_token')
    ? children
    : <Navigate to="/receiver" replace />
}

export default function ReceiverDashboard() {
  const navigate = useNavigate()
  const [receiver, setReceiver] = useState(null)
  const [error, setError] = useState('')
  const signOut = useCallback(() => {
    sessionStorage.removeItem('mcet_receiver_token')
    sessionStorage.removeItem('mcet_receiver_id')
    navigate('/receiver', { replace: true })
  }, [navigate])

  useEffect(() => {
    let mounted = true
    const heartbeat = async () => {
      try {
        const data = await receiverHeartbeat()
        if (mounted) {
          setReceiver(data)
          setError('')
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOut()
        } else if (mounted) {
          setError(apiErrorMessage(err, 'Receiver heartbeat failed. Sign in again if the session expired.'))
        }
      }
    }

    getReceiver()
      .then((data) => {
        if (mounted) setReceiver(data)
        return heartbeat()
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          signOut()
        } else if (mounted) {
          setError(apiErrorMessage(err, 'Could not load this receiver. Sign in again.'))
        }
      })
    const interval = window.setInterval(heartbeat, 20000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [signOut])

  if (!sessionStorage.getItem('mcet_receiver_token')) return <Navigate to="/receiver" replace />

  return (
    <main className="min-h-screen bg-slate-950 text-brass-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-brass-400">
              <Radio size={20} />
              <span className="text-xs uppercase tracking-[0.2em]">Fixed location receiver</span>
            </div>
            <h1 className="font-display text-2xl mt-2">{receiver?.name || 'Connecting…'}</h1>
            <p className="text-xs text-white/40 mt-1">Receiver #{receiver?.id || sessionStorage.getItem('mcet_receiver_id')}</p>
          </div>
          <button className="btn-ghost text-xs" onClick={signOut}><LogOut size={14} /> Sign out</button>
        </header>

        {error && (
          <div role="alert" className="mt-5 border border-signal-red/40 bg-signal-red/10 p-3 text-sm text-signal-red flex gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {receiver && (
          <>
            <section className="grid sm:grid-cols-2 gap-4 mt-6">
              <div className="border border-white/10 bg-[#0D1521] p-5">
                <div className="flex items-center gap-2 text-signal-green text-sm">
                  <Wifi size={16} /> Receiver active
                </div>
                <div className="flex items-center gap-2 mt-4 text-sm">
                  {receiver.is_restricted
                    ? <ShieldAlert size={18} className="text-signal-red" />
                    : <ShieldCheck size={18} className="text-signal-green" />}
                  <span className={receiver.is_restricted ? 'text-signal-red' : 'text-signal-green'}>
                    {receiver.is_restricted ? 'Restricted area' : 'Unrestricted area'}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-3">
                  {receiver.status === 'active' ? 'Enabled in the admin console' : 'Disabled by an administrator'}
                </p>
                <p className="text-[11px] text-white/35 mt-1">
                  Last server heartbeat: {receiver.last_seen_at ? parseApiTimestamp(receiver.last_seen_at).toLocaleTimeString() : 'sending…'}
                </p>
              </div>
              <div className="border border-white/10 bg-[#0D1521] p-5">
                <div className="flex items-center gap-2 text-brass-300 text-sm">
                  <MapPin size={16} /> Geofence anchor
                </div>
                <p className="font-mono text-sm mt-4">{receiver.latitude.toFixed(6)}, {receiver.longitude.toFixed(6)}</p>
                <p className="text-xs text-white/45 mt-2">Detection radius: {receiver.radius_m} m</p>
                <p className="text-xs text-white/35 mt-1">GPS proximity is calculated server-side from visitor location updates.</p>
              </div>
            </section>

            <section className="border border-white/10 bg-[#0D1521] p-5 mt-5">
              <h2 className="text-sm flex items-center gap-2"><Radio size={16} /> Native BLE receiver</h2>
              <p className="text-xs leading-relaxed text-white/45 mt-3">
                This browser page cannot run a reliable background BLE scan. Install the MCET Location Monitor Android app, choose Fixed receiver, and sign in with this receiver ID and PIN to scan consented visitor beacons without pairing.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
