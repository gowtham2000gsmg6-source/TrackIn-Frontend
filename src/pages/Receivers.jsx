import React, { useCallback, useEffect, useState } from 'react'
import { Edit3, MapPin, Plus, Radio, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createLocationReceiver,
  getLocationReceivers,
  updateLocationReceiver,
} from '../api/visitors'
import { apiErrorMessage, parseApiTimestamp } from '../api/client'

const EMPTY_FORM = {
  name: '',
  latitude: '',
  longitude: '',
  radius_m: '100',
  is_restricted: false,
  pin: '',
}

export default function Receivers() {
  const [receivers, setReceivers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setReceivers(await getLocationReceivers())
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load location receivers'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const editReceiver = (receiver) => {
    setEditingId(receiver.id)
    setForm({
      name: receiver.name,
      latitude: String(receiver.latitude),
      longitude: String(receiver.longitude),
      radius_m: String(receiver.radius_m),
      is_restricted: receiver.is_restricted,
      pin: '',
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radius_m: Number(form.radius_m),
      is_restricted: form.is_restricted,
    }
    if (form.pin) payload.pin = form.pin
    try {
      if (editingId) {
        await updateLocationReceiver(editingId, payload)
        toast.success('Receiver updated')
      } else {
        if (!form.pin) {
          toast.error('Set a receiver PIN before creating the unit')
          return
        }
        await createLocationReceiver(payload)
        toast.success('Receiver created')
      }
      resetForm()
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save receiver'))
    } finally {
      setSaving(false)
    }
  }

  const changeReceiver = async (receiver, changes) => {
    try {
      await updateLocationReceiver(receiver.id, changes)
      await load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update receiver'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-brass-50 flex items-center gap-2">
            <Radio size={20} className="text-brass-400" /> Location Receivers
          </h1>
          <p className="text-sm text-white/40 mt-1">Configure fixed geofence anchors and receiver PIN sessions.</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={14} /> Refresh</button>
      </div>

      <form onSubmit={handleSubmit} className="border border-white/10 bg-[#0D1521] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-brass-100">{editingId ? `Edit receiver #${editingId}` : 'Add a receiver'}</h2>
          {editingId && <button type="button" className="text-white/50 hover:text-white" onClick={resetForm} aria-label="Cancel editing"><X size={16} /></button>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="ledger-label" htmlFor="receiver-name">Location name</label>
            <input id="receiver-name" className="ledger-input" required maxLength="120" value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Main Library Entrance" />
          </div>
          <div>
            <label className="ledger-label" htmlFor="receiver-pin">{editingId ? 'Replace PIN (optional)' : 'Receiver PIN'}</label>
            <input id="receiver-pin" className="ledger-input" type="password" minLength="6" maxLength="12"
              pattern="[0-9]{6,12}" inputMode="numeric"
              required={!editingId} value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })}
              autoComplete="new-password" placeholder="6–12 digits" />
          </div>
          <div>
            <label className="ledger-label" htmlFor="receiver-lat">Latitude</label>
            <input id="receiver-lat" className="ledger-input" type="number" step="any" min="-90" max="90" required
              value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} />
          </div>
          <div>
            <label className="ledger-label" htmlFor="receiver-lng">Longitude</label>
            <input id="receiver-lng" className="ledger-input" type="number" step="any" min="-180" max="180" required
              value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} />
          </div>
          <div>
            <label className="ledger-label" htmlFor="receiver-radius">Detection radius (metres)</label>
            <input id="receiver-radius" className="ledger-input" type="number" step="any" min="1" max="10000" required
              value={form.radius_m} onChange={(event) => setForm({ ...form, radius_m: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70 self-end pb-2">
            <input type="checkbox" checked={form.is_restricted}
              onChange={(event) => setForm({ ...form, is_restricted: event.target.checked })} />
            Restricted area
          </label>
        </div>
        <button type="submit" disabled={saving} className="btn-primary mt-5 text-xs">
          {editingId ? <Edit3 size={14} /> : <Plus size={14} />}
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create receiver'}
        </button>
      </form>

      <div className="border border-white/10">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-wider text-white/40">
          <span>Receiver location</span><span>Controls</span>
        </div>
        {loading ? <p className="px-4 py-8 text-center text-sm text-white/40">Loading receivers…</p> :
          receivers.length ? receivers.map((receiver) => {
            const isOnline = receiver.status === 'active' && receiver.last_seen_at &&
              Date.now() - parseApiTimestamp(receiver.last_seen_at).getTime() < 60000
            return (
              <div key={receiver.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-4 py-4 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-brass-50">{receiver.name} <span className="text-xs text-white/35">#{receiver.id}</span></p>
                  <p className="flex items-center gap-1 text-xs text-white/45 mt-1">
                    <MapPin size={12} /> {receiver.latitude.toFixed(6)}, {receiver.longitude.toFixed(6)} · {receiver.radius_m} m
                  </p>
                  <p className={`text-xs mt-1 ${receiver.is_restricted ? 'text-signal-red' : 'text-signal-green'}`}>
                    {receiver.is_restricted ? 'Restricted' : 'Unrestricted'} · {isOnline ? 'Online' : receiver.status === 'active' ? 'Waiting for heartbeat' : 'Inactive'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => changeReceiver(receiver, { is_restricted: !receiver.is_restricted })}
                    className="btn-ghost text-[11px]">
                    {receiver.is_restricted ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                    {receiver.is_restricted ? 'Mark unrestricted' : 'Mark restricted'}
                  </button>
                  <button onClick={() => changeReceiver(receiver, { status: receiver.status === 'active' ? 'inactive' : 'active' })}
                    className="btn-ghost text-[11px]">
                    {receiver.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => editReceiver(receiver)} className="btn-ghost text-[11px]"><Edit3 size={13} /> Edit</button>
                </div>
              </div>
            )
          }) : <p className="px-4 py-8 text-center text-sm text-white/40">No receiver anchors configured.</p>}
      </div>
    </div>
  )
}
