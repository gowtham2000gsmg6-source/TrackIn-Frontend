import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertTriangle, Bluetooth, LogOut, MapPin, Radio, ShieldAlert, ShieldCheck, Wifi } from 'lucide-react'
import { getReceiver, receiverHeartbeat, reportBluetoothDetection } from '../api/receivers'
import { apiErrorMessage, parseApiTimestamp } from '../api/client'

const BEACON_PREFIX = 'MCET:'

export function ReceiverGuard({ children }) {
  return sessionStorage.getItem('mcet_receiver_token')
    ? children
    : <Navigate to="/receiver" replace />
}

export default function ReceiverDashboard() {
  const navigate = useNavigate()
  const [receiver, setReceiver] = useState(null)
  const [error, setError] = useState('')
  const [scanState, setScanState] = useState('idle')
  const [scanMessage, setScanMessage] = useState('')
  const [lastDetection, setLastDetection] = useState(null)
  const scanRef = useRef(null)
  const advertisementHandlerRef = useRef(null)
  const seenRef = useRef(new Map())

  const signOut = useCallback(() => {
    if (scanRef.current) scanRef.current.stop()
    scanRef.current = null
    if (advertisementHandlerRef.current && navigator.bluetooth) {
      navigator.bluetooth.removeEventListener('advertisementreceived', advertisementHandlerRef.current)
    }
    advertisementHandlerRef.current = null
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
      if (scanRef.current) scanRef.current.stop()
      scanRef.current = null
      if (advertisementHandlerRef.current && navigator.bluetooth) {
        navigator.bluetooth.removeEventListener('advertisementreceived', advertisementHandlerRef.current)
      }
      advertisementHandlerRef.current = null
    }
  }, [signOut])

  const startBluetoothScan = async () => {
    setScanMessage('')
    if (!window.isSecureContext) {
      setScanState('unavailable')
      setScanMessage('Bluetooth scanning requires HTTPS (or localhost).')
      return
    }
    const bluetooth = navigator.bluetooth
    if (!bluetooth || typeof bluetooth.requestLEScan !== 'function') {
      setScanState('unavailable')
      setScanMessage('This browser does not expose Web Bluetooth LE scanning. Keep GPS geofencing enabled; use a supported Android Chrome build for BLE.')
      return
    }
    try {
      if (scanRef.current) scanRef.current.stop()
      const scan = await bluetooth.requestLEScan({
        filters: [{ namePrefix: BEACON_PREFIX }],
        keepRepeatedDevices: true,
      })
      scanRef.current = scan
      const onAdvertisement = async (event) => {
        const name = event.device?.name || ''
        if (!name.startsWith(BEACON_PREFIX)) return
        const visitorId = name.slice(BEACON_PREFIX.length).trim()
        if (!/^MCET-\d+$/i.test(visitorId)) return
        const now = Date.now()
        if (now - (seenRef.current.get(visitorId) || 0) < 30000) return
        seenRef.current.set(visitorId, now)
        try {
          const log = await reportBluetoothDetection(visitorId)
          setLastDetection(`${log.visitor_id} near ${log.receiver_name} · Bluetooth`)
          setScanMessage(`Detected ${log.visitor_id} at ${parseApiTimestamp(log.timestamp).toLocaleTimeString()}.`)
        } catch (err) {
          setScanMessage(apiErrorMessage(err, `Could not record beacon ${visitorId}.`))
        }
      }
      advertisementHandlerRef.current = onAdvertisement
      bluetooth.addEventListener('advertisementreceived', onAdvertisement)
      setScanState('scanning')
      setScanMessage(`Scanning for visitor beacons advertising ${BEACON_PREFIX}<visitor-id>.`)
    } catch (err) {
      setScanState('error')
      setScanMessage(apiErrorMessage(err, 'Bluetooth scan could not start. Check browser permissions and try again.'))
    }
  }

  const stopBluetoothScan = () => {
    if (scanRef.current) scanRef.current.stop()
    if (advertisementHandlerRef.current && navigator.bluetooth) {
      navigator.bluetooth.removeEventListener('advertisementreceived', advertisementHandlerRef.current)
    }
    scanRef.current = null
    advertisementHandlerRef.current = null
    setScanState('idle')
  }

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
              <div className="flex items-center gap-2">
                <Bluetooth size={17} className={scanState === 'scanning' ? 'text-signal-green' : 'text-brass-300'} />
                <h2 className="text-sm">Supplementary Bluetooth scan</h2>
                <span className="ml-auto text-[11px] uppercase tracking-wider text-white/40">
                  {scanState === 'scanning' ? 'Scanning' : scanState}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-white/45 mt-3">
                BLE is opt-in and browser-limited. A visitor must advertise a Bluetooth device named
                <code className="mx-1 text-brass-200">{BEACON_PREFIX}MCET-0001</code>
                (using their own configured beacon hardware/app). Ordinary phones cannot be silently discovered by a webpage.
              </p>
              {lastDetection && <p className="text-xs text-signal-green mt-3">{lastDetection}</p>}
              {scanMessage && <p role="status" className="text-xs text-white/60 mt-3">{scanMessage}</p>}
              <div className="mt-4">
                {scanState === 'scanning' ? (
                  <button className="btn-ghost text-xs" onClick={stopBluetoothScan}>Stop Bluetooth scan</button>
                ) : (
                  <button className="btn-primary text-xs" onClick={startBluetoothScan}>
                    <Bluetooth size={14} /> Start Bluetooth scan
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
