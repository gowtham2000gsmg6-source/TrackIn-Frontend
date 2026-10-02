import React, { useEffect, useRef, useState } from 'react'
import { ShieldCheck, MapPin, Loader2, CheckCircle2, Radio, AlertTriangle, Bluetooth, BluetoothOff } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  registerVisitor,
  pushLocation,
  reportVisitorBluetoothDevice,
  stopVisitorBluetoothDevice,
} from '../api/visitors'
import { apiErrorMessage } from '../api/client'

const EMPTY = {
  full_name: '',
  phone_number: '',
  email: '',
  department: '',
  person_to_meet: '',
  purpose: '',
}

function Field({ label, name, value, onChange, error, ...rest }) {
  return (
    <div>
      <label className="ledger-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} value={value} onChange={onChange} className="ledger-input" {...rest} />
      {error && <p className="text-signal-red text-xs mt-1">{error}</p>}
    </div>
  )
}

// This page is deliberately login-free: a visitor arrives here by scanning a
// QR code / tapping a link at the gate. There is no admin-vs-visitor picker —
// anyone landing here is registering themselves as a visitor.
export default function VisitorCheckIn() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [visitor, setVisitor] = useState(null) // { visitor_id, full_name, access_token }
  const [locationStatus, setLocationStatus] = useState('idle') // idle | requesting | sharing | denied | error | ended
  const [lastSent, setLastSent] = useState(null)
  const [bluetoothStatus, setBluetoothStatus] = useState('idle')
  const [bluetoothDeviceName, setBluetoothDeviceName] = useState('')
  const [bluetoothError, setBluetoothError] = useState('')
  const watchIdRef = useRef(null)
  const pendingPositionRef = useRef(null)
  const sendingLocationRef = useRef(false)
  const trackingEndedRef = useRef(false)
  const bluetoothDeviceRef = useRef(null)
  const bluetoothHeartbeatRef = useRef(null)
  const bluetoothDisconnectHandlerRef = useRef(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((err) => ({ ...err, [name]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Your name is required.'
    if (!form.phone_number.trim()) e.phone_number = 'Phone number is required.'
    else if (form.phone_number.trim().length < 10) e.phone_number = 'Enter at least 10 digits.'
    if (!form.department.trim()) e.department = 'Department you are visiting is required.'
    if (!form.person_to_meet.trim()) e.person_to_meet = 'Who you are meeting is required.'
    if (!form.purpose.trim()) e.purpose = 'Purpose of visit is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        email: form.email.trim() || undefined,
        device_info: navigator.userAgent?.slice(0, 120),
        browser_info: `${navigator.platform || ''}`.slice(0, 60),
      }
      const result = await registerVisitor(payload)
      setVisitor(result)
      // Keep the token only for this tab's session, never in localStorage,
      // so it can never collide with a gate-staff admin session.
      sessionStorage.setItem('mcet_visitor_token', result.access_token)
      sessionStorage.setItem('mcet_visitor_id', result.visitor_id)
      toast.success(`Welcome, ${result.full_name}! You're registered.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Registration failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const startSharingLocation = () => {
    if (!visitor) return
    if (!('geolocation' in navigator)) {
      setLocationStatus('error')
      toast.error('This device/browser does not support location sharing.')
      return
    }
    setLocationStatus('requesting')

    const send = async (position) => {
      if (trackingEndedRef.current) return
      pendingPositionRef.current = position
      if (sendingLocationRef.current) return
      sendingLocationRef.current = true
      try {
        while (pendingPositionRef.current && !trackingEndedRef.current) {
          const nextPosition = pendingPositionRef.current
          pendingPositionRef.current = null
          const { latitude, longitude, accuracy, speed, heading } = nextPosition.coords
          try {
            await pushLocation(visitor.access_token, {
              latitude,
              longitude,
              accuracy,
              speed: speed ?? undefined,
              heading: heading ?? undefined,
            })
            setLocationStatus('sharing')
            setLastSent(new Date())
          } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
              trackingEndedRef.current = true
              pendingPositionRef.current = null
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
                watchIdRef.current = null
              }
              setLocationStatus('ended')
              break
            }
            // Don't spam toasts on every watch tick — surface once via state.
            setLocationStatus('error')
          }
        }
      } finally {
        sendingLocationRef.current = false
      }
    }

    navigator.geolocation.getCurrentPosition(
      send,
      () => {
        setLocationStatus('denied')
        toast.error('Location permission denied. The gate cannot see you on the map without it.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      send,
      () => setLocationStatus((s) => (s === 'sharing' ? s : 'denied')),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  const stopBluetoothSharing = async () => {
    if (bluetoothHeartbeatRef.current !== null) {
      window.clearInterval(bluetoothHeartbeatRef.current)
      bluetoothHeartbeatRef.current = null
    }
    const device = bluetoothDeviceRef.current
    if (device && bluetoothDisconnectHandlerRef.current) {
      device.removeEventListener('gattserverdisconnected', bluetoothDisconnectHandlerRef.current)
    }
    bluetoothDisconnectHandlerRef.current = null
    bluetoothDeviceRef.current = null
    if (device?.gatt?.connected) device.gatt.disconnect()
    setBluetoothStatus('idle')
    setBluetoothDeviceName('')
    try {
      if (visitor?.access_token) await stopVisitorBluetoothDevice(visitor.access_token)
    } catch (err) {
      setBluetoothError(apiErrorMessage(err, 'Could not stop Bluetooth reporting on the server.'))
    }
  }

  const startBluetoothSharing = async () => {
    setBluetoothError('')
    const bluetooth = navigator.bluetooth
    if (!window.isSecureContext) {
      setBluetoothStatus('unavailable')
      setBluetoothError('Bluetooth selection requires HTTPS (or localhost).')
      return
    }
    if (!bluetooth || typeof bluetooth.requestDevice !== 'function') {
      setBluetoothStatus('unavailable')
      setBluetoothError('This browser does not support Web Bluetooth. You can continue sharing GPS without it.')
      return
    }

    setBluetoothStatus('selecting')
    try {
      const device = await bluetooth.requestDevice({ acceptAllDevices: true })
      if (!device.gatt) {
        throw new Error('The selected Bluetooth device does not support a browser GATT connection.')
      }
      await device.gatt.connect()
      bluetoothDeviceRef.current = device
      const deviceName = (device.name || 'Unnamed Bluetooth device').slice(0, 100)
      const disconnectHandler = async () => {
        if (bluetoothDeviceRef.current !== device) return
        bluetoothDeviceRef.current = null
        bluetoothDisconnectHandlerRef.current = null
        if (bluetoothHeartbeatRef.current !== null) {
          window.clearInterval(bluetoothHeartbeatRef.current)
          bluetoothHeartbeatRef.current = null
        }
        setBluetoothStatus('disconnected')
        setBluetoothDeviceName('')
        try {
          await stopVisitorBluetoothDevice(visitor.access_token)
        } catch (err) {
          setBluetoothError(apiErrorMessage(err, 'Bluetooth disconnected, but the server status could not be updated.'))
        }
      }
      bluetoothDisconnectHandlerRef.current = disconnectHandler
      device.addEventListener('gattserverdisconnected', disconnectHandler)
      await reportVisitorBluetoothDevice(visitor.access_token, deviceName)
      setBluetoothDeviceName(deviceName)
      setBluetoothStatus('connected')
      bluetoothHeartbeatRef.current = window.setInterval(async () => {
        if (!device.gatt?.connected) return
        try {
          await reportVisitorBluetoothDevice(visitor.access_token, deviceName)
        } catch (err) {
          setBluetoothError(apiErrorMessage(err, 'Could not refresh Bluetooth status on the server.'))
        }
      }, 30000)
    } catch (err) {
      if (bluetoothDeviceRef.current?.gatt?.connected) bluetoothDeviceRef.current.gatt.disconnect()
      bluetoothDeviceRef.current = null
      setBluetoothStatus('error')
      setBluetoothError(apiErrorMessage(err, 'Bluetooth permission or connection failed. You can retry or continue with GPS only.'))
    }
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (bluetoothHeartbeatRef.current !== null) {
        window.clearInterval(bluetoothHeartbeatRef.current)
      }
      if (bluetoothDeviceRef.current && bluetoothDisconnectHandlerRef.current) {
        bluetoothDeviceRef.current.removeEventListener(
          'gattserverdisconnected',
          bluetoothDisconnectHandlerRef.current,
        )
      }
      if (bluetoothDeviceRef.current?.gatt?.connected) {
        bluetoothDeviceRef.current.gatt.disconnect()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-brass-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-1 text-brass-400 justify-center">
          <ShieldCheck size={20} strokeWidth={1.75} />
          <span className="font-display text-lg">MCET Gate</span>
        </div>
        <p className="text-center text-sm text-white/40 mb-8">Visitor Self Check-In</p>

        {!visitor ? (
          <form onSubmit={handleSubmit} className="border border-white/10 bg-[#0D1521] p-6 space-y-5">
            <Field label="Your Name" name="full_name" value={form.full_name} onChange={handleChange}
              error={errors.full_name} placeholder="Full name" autoComplete="name" />
            <Field label="Phone Number" name="phone_number" value={form.phone_number} onChange={handleChange}
              error={errors.phone_number} placeholder="98765 43210" inputMode="tel" autoComplete="tel" />
            <Field label="Email (optional)" name="email" value={form.email} onChange={handleChange}
              placeholder="name@example.com" type="email" autoComplete="email" />
            <Field label="Department You're Visiting" name="department" value={form.department} onChange={handleChange}
              error={errors.department} placeholder="Computer Science" />
            <Field label="Person to Meet" name="person_to_meet" value={form.person_to_meet} onChange={handleChange}
              error={errors.person_to_meet} placeholder="Dr. Ramasamy (HOD)" />
            <Field label="Purpose of Visit" name="purpose" value={form.purpose} onChange={handleChange}
              error={errors.purpose} placeholder="Guest lecture, project review, etc." />

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Check In'}
            </button>
            <p className="text-[11px] text-white/30 text-center pt-1">
              No account or login needed — just fill this in at the gate.
            </p>
          </form>
        ) : (
          <div className="border border-white/10 bg-[#0D1521] p-6 space-y-5 text-center">
            <CheckCircle2 className="mx-auto text-signal-green" size={32} strokeWidth={1.5} />
            <div>
              <p className="text-sm text-white/50">You're checked in as</p>
              <p className="font-display text-xl text-brass-50">{visitor.full_name}</p>
              <p className="text-xs text-white/40 font-mono mt-1">{visitor.visitor_id}</p>
            </div>

            <div className="border-t border-white/10 pt-5">
              {locationStatus === 'idle' && (
                <>
                  <p className="text-sm text-white/50 mb-4">
                    Turn on location to share your coordinates with campus security and record geofence entries while you are on campus.
                  </p>
                  <button onClick={startSharingLocation} className="btn-primary w-full">
                    <MapPin size={16} /> Turn On Location
                  </button>
                </>
              )}
              {locationStatus === 'requesting' && (
                <p className="text-sm text-white/50 flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Requesting location permission…
                </p>
              )}
              {locationStatus === 'sharing' && (
                <div className="text-sm text-signal-green flex items-center justify-center gap-2">
                  <Radio size={15} className="animate-pulse" /> Sharing live location with the gate
                  {lastSent && (
                    <span className="block text-[11px] text-white/35 mt-1 ml-1">
                      last update {lastSent.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
              {locationStatus === 'denied' && (
                <div className="text-sm text-signal-amber flex items-start gap-2 text-left">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Location permission was denied. Enable it in your browser settings and tap the button again.
                  </span>
                </div>
              )}
              {locationStatus === 'error' && (
                <div className="text-sm text-signal-red flex items-start gap-2 text-left">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>Couldn't reach the server to share your location. Check your connection.</span>
                </div>
              )}
              {locationStatus === 'ended' && (
                <p className="text-sm text-white/50">Location sharing stopped because the visit ended or its tracking session expired.</p>
              )}
              {(locationStatus === 'denied' || locationStatus === 'error') && (
                <button onClick={startSharingLocation} className="btn-ghost w-full mt-3 text-xs">
                  Try Again
                </button>
              )}
            </div>

            <div className="border-t border-white/10 pt-5 text-left">
              <p className="text-sm text-white/70 flex items-center gap-2">
                <Bluetooth size={16} className={bluetoothStatus === 'connected' ? 'text-signal-green' : 'text-brass-300'} />
                Optional Bluetooth device sharing
              </p>
              <p className="text-xs text-white/40 mt-2">
                Choose and connect to one nearby Bluetooth device. Its name and connection status will be visible to authorized campus admins alongside your GPS location. This does not scan or report other nearby devices.
              </p>
              {bluetoothDeviceName && (
                <p className="text-xs text-signal-green mt-3">
                  Connected device: {bluetoothDeviceName}
                </p>
              )}
              {bluetoothStatus === 'disconnected' && (
                <p className="text-xs text-signal-amber mt-2">Bluetooth device disconnected. Its live status has been cleared.</p>
              )}
              {bluetoothError && (
                <p role="alert" className="text-xs text-signal-red mt-2">{bluetoothError}</p>
              )}
              {bluetoothStatus === 'connected' ? (
                <button onClick={stopBluetoothSharing} className="btn-ghost w-full mt-3 text-xs">
                  <BluetoothOff size={14} /> Stop Bluetooth sharing
                </button>
              ) : (
                <button
                  onClick={startBluetoothSharing}
                  disabled={bluetoothStatus === 'selecting'}
                  className="btn-ghost w-full mt-3 text-xs"
                >
                  {bluetoothStatus === 'selecting' ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
                  {bluetoothStatus === 'selecting' ? 'Choose a device…' : 'Choose Bluetooth device'}
                </button>
              )}
              <p className="text-[11px] text-white/30 mt-2">
                Bluetooth is optional. Continue with GPS if your browser or device does not support it.
              </p>
            </div>

            <p className="text-[11px] text-white/30">
              Keep this page open while sharing; mobile browsers may pause location tracking in the background. Please check out at the gate before you leave.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
