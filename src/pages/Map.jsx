import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Bluetooth,
  Clock3,
  MapPin,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getLiveAll, getLocationReceivers, getVisitorLocationLogs } from '../api/visitors'
import { apiErrorMessage, parseApiTimestamp } from '../api/client'
import StatusBadge from '../components/StatusBadge.jsx'

import 'leaflet/dist/leaflet.css'

// Vite bundles the marker icon URLs oddly with Leaflet by default — wire them
// up explicitly so pins render instead of showing broken images.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = defaultIcon
const visitorIcon = L.divIcon({
  className: 'visitor-map-pin',
  html: '<span><i></i></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
})

// Fallback centre: MCET campus (used until we have any live GPS fix).
const DEFAULT_CENTER = [10.5983, 77.0270]
const DEFAULT_ZOOM = 16

function FitToMarkers({ points, selected }) {
  const map = useMap()
  useEffect(() => {
    if (selected) return // selection handles its own framing
    if (!points.length) return
    if (points.length === 1) {
      map.setView(points[0], 17)
    } else {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 18 })
    }
  }, [points, map, selected])
  return null
}

function FlyToSelected({ selected }) {
  const map = useMap()
  useEffect(() => {
    if (!selected) return
    map.flyTo([selected.last_latitude, selected.last_longitude], 19, { duration: 0.75 })
  }, [selected, map])
  return null
}

export default function MapPage() {
  const [visitors, setVisitors] = useState([])
  const [receivers, setReceivers] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const markerRefs = React.useRef({})

  const load = useCallback(async () => {
    try {
      const [live, anchors, entries] = await Promise.all([
        getLiveAll(),
        getLocationReceivers(),
        getVisitorLocationLogs(100),
      ])
      setVisitors(live)
      setReceivers(anchors)
      setLogs(entries)
      setLastRefresh(new Date())
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not load live locations'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  const located = visitors.filter((v) => v.last_latitude != null && v.last_longitude != null)
  const notLocated = visitors.filter((v) => v.last_latitude == null || v.last_longitude == null)
  const points = [
    ...located.map((v) => [v.last_latitude, v.last_longitude]),
    ...receivers.filter((r) => r.status === 'active').map((r) => [r.latitude, r.longitude]),
  ]
  const activeReceivers = receivers.filter((receiver) => receiver.status === 'active')
  const restrictedReceivers = activeReceivers.filter((receiver) => receiver.is_restricted)
  const restrictedReceiverIds = new Set(restrictedReceivers.map((receiver) => receiver.id))
  const restrictedEntries = logs.filter((log) => restrictedReceiverIds.has(log.receiver_id))
  const selected = located.find((v) => v.visitor_id === selectedId) || null

  const handleSelect = (visitorId) => {
    const v = located.find((x) => x.visitor_id === visitorId)
    if (!v) {
      toast.error("This visitor isn't sharing location yet.")
      return
    }
    setSelectedId(visitorId)
    // Open the popup once the map has flown there.
    setTimeout(() => {
      const marker = markerRefs.current[visitorId]
      if (marker) marker.openPopup()
    }, 400)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/40">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading map…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-brass-400/80">Campus monitoring</p>
          <h1 className="font-display text-3xl text-brass-50 flex items-center gap-3 mt-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brass-400/20 bg-brass-400/10">
              <MapPin size={21} className="text-brass-300" strokeWidth={1.75} />
            </span>
            Live visitor map
          </h1>
          <p className="text-sm text-white/45 mt-2">
            GPS positions, receiver geofences, and proximity activity in one view.
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs self-start sm:self-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh map
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Sharing GPS', value: located.length, detail: `${notLocated.length} without a fix`, icon: Users, color: 'text-sky-300', tint: 'bg-sky-400/10' },
          { label: 'Active receivers', value: activeReceivers.length, detail: 'Live geofence anchors', icon: MapPin, color: 'text-emerald-300', tint: 'bg-emerald-400/10' },
          { label: 'Restricted zones', value: restrictedReceivers.length, detail: 'Red geofence boundaries', icon: ShieldAlert, color: 'text-rose-300', tint: 'bg-rose-400/10' },
          { label: 'Restricted entries', value: restrictedEntries.length, detail: 'Recent proximity events', icon: ShieldCheck, color: 'text-amber-300', tint: 'bg-amber-400/10' },
        ].map(({ label, value, detail, icon: Icon, color, tint }) => (
          <div key={label} className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-white/45">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-brass-50">{value}</p>
              </div>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint} ${color}`}>
                <Icon size={17} />
              </span>
            </div>
            <p className="mt-2 text-[11px] text-white/35">{detail}</p>
          </div>
        ))}
      </div>

      {selected && (
        <div className="flex items-center justify-between rounded-lg border border-brass-400/30 bg-brass-400/5 px-4 py-3 text-sm">
          <span className="text-brass-200">
            Focused on <span className="text-brass-50">{selected.full_name}</span>
            <span className="text-white/40 font-mono ml-2 text-xs">{selected.visitor_id}</span>
          </span>
          <button onClick={() => setSelectedId(null)} className="text-xs text-white/50 hover:text-white/80">
            Show all
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/20">
        <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-2">
          <span className="flex items-center gap-2 rounded-lg border border-slate-900/10 bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-lg">
            <i className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Visitor
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-slate-900/10 bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-lg">
            <i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Restricted
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-slate-900/10 bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-lg">
            <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Unrestricted
          </span>
        </div>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: 'min(68vh, 620px)', minHeight: 430, width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToMarkers points={points} selected={selected} />
          <FlyToSelected selected={selected} />
          {located.map((v) => (
            <Marker
              key={v.visitor_id}
              position={[v.last_latitude, v.last_longitude]}
              icon={visitorIcon}
              ref={(el) => {
                if (el) markerRefs.current[v.visitor_id] = el
              }}
              eventHandlers={{ click: () => setSelectedId(v.visitor_id) }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{v.full_name}</p>
                  <p className="text-xs text-slate-500">{v.visitor_id} · {v.department}</p>
                  <p className="text-xs mt-1">{v.purpose}</p>
                  {v.nearby_bluetooth?.map((device) => (
                    <p key={device.receiver_id} className="text-xs mt-2 text-emerald-700">
                      BLE near {device.receiver_name} · {device.rssi} dBm
                    </p>
                  ))}
                  {v.last_updated && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      updated {parseApiTimestamp(v.last_updated).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {activeReceivers.map((receiver) => {
            const color = receiver.is_restricted ? '#ef4444' : '#22c55e'
            return (
              <React.Fragment key={`receiver-${receiver.id}`}>
                <Circle
                  center={[receiver.latitude, receiver.longitude]}
                  radius={receiver.radius_m}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
                />
                <CircleMarker
                  center={[receiver.latitude, receiver.longitude]}
                  radius={8}
                  pathOptions={{ color: '#0f172a', weight: 2, fillColor: color, fillOpacity: 1 }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{receiver.name}</p>
                      <p className="text-xs">{receiver.is_restricted ? 'Restricted' : 'Unrestricted'} · {receiver.radius_m} m radius</p>
                      <p className="text-[11px] text-slate-500">
                        {receiver.latitude.toFixed(6)}, {receiver.longitude.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            )
          })}
        </MapContainer>
        <div className="flex flex-col gap-1 border-t border-white/[0.08] bg-slate-900/95 px-4 py-3 text-[11px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>Open a marker for visitor or receiver details. Use the list below to focus a visitor.</span>
          <span className="flex items-center gap-1.5">
            <Clock3 size={12} />
            {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Waiting for live data'}
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Refreshes every 10 seconds
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
          <div>
            <h2 className="text-sm font-medium text-brass-50">Active receiver anchors</h2>
            <p className="mt-1 text-xs text-white/35">Geofence radius and area classification</p>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60">{activeReceivers.length} active</span>
        </div>
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeReceivers.map((receiver) => (
            <div key={receiver.id} className={`rounded-lg border p-4 ${receiver.is_restricted ? 'border-rose-400/20 bg-rose-400/[0.045]' : 'border-emerald-400/15 bg-emerald-400/[0.035]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${receiver.is_restricted ? 'bg-rose-400/10 text-rose-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
                    {receiver.is_restricted ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-brass-50">{receiver.name}</p>
                    <p className={`mt-0.5 text-[11px] ${receiver.is_restricted ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {receiver.is_restricted ? 'Restricted zone' : 'Unrestricted zone'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] text-white/55">#{receiver.id}</span>
              </div>
              <p className="mt-3 text-xs text-white/45">{receiver.radius_m} m radius geofence</p>
              <p className="mt-1 text-[11px] text-white/30">{receiver.latitude.toFixed(5)}, {receiver.longitude.toFixed(5)}</p>
            </div>
          ))}
          {!activeReceivers.length && (
            <p className="px-4 py-5 text-sm text-white/35">No active receiver anchors. Configure them under Location Receivers.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4 text-brass-50">
            <Wifi size={15} className="text-signal-green" />
            <h2 className="text-sm">Sharing location ({located.length})</h2>
          </div>
          <div className="divide-y divide-white/10">
            {located.length ? located.map((v) => (
              <button
                key={v.visitor_id}
                onClick={() => handleSelect(v.visitor_id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  selectedId === v.visitor_id ? 'bg-brass-400/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-sm truncate ${selectedId === v.visitor_id ? 'text-brass-300' : 'text-brass-50'}`}>
                    {v.full_name}
                  </p>
                  <p className="text-xs text-white/40 font-mono">{v.visitor_id} · {v.department}</p>
                  {v.nearby_bluetooth?.map((device) => (
                    <p key={device.receiver_id} className="text-xs mt-1 flex items-center gap-1 text-signal-green">
                      <Bluetooth size={12} /> Near {device.receiver_name} · {device.rssi} dBm
                    </p>
                  ))}
                </div>
                <StatusBadge status={v.status} />
              </button>
            )) : (
              <p className="px-4 py-6 text-center text-sm text-white/35">No one is sharing location right now.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4 text-brass-50">
            <WifiOff size={15} className="text-white/40" />
            <h2 className="text-sm">Location not on ({notLocated.length})</h2>
          </div>
          <div className="divide-y divide-white/10">
            {notLocated.length ? notLocated.map((v) => (
              <div key={v.visitor_id} className="flex items-center justify-between px-4 py-2.5 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm text-brass-50 truncate">{v.full_name}</p>
                  <p className="text-xs text-white/40 font-mono">{v.visitor_id} · {v.department}</p>
                  {v.nearby_bluetooth?.map((device) => (
                    <p key={device.receiver_id} className="text-xs mt-1 flex items-center gap-1 text-signal-green">
                      <Bluetooth size={12} /> Near {device.receiver_name} · {device.rssi} dBm
                    </p>
                  ))}
                </div>
                <StatusBadge status={v.status} />
              </div>
            )) : (
              <p className="px-4 py-6 text-center text-sm text-white/35">Everyone on campus is sharing location.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex flex-col gap-1 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Recent receiver proximity entries</h2>
            <p className="mt-1 text-xs text-white/35">GPS geofence transitions and receiver BLE reports</p>
          </div>
          <span className="text-xs text-white/40">{logs.length} recent events</span>
        </div>
        <div className="divide-y divide-white/10">
          {logs.length ? logs.slice(0, 20).map((log) => {
            const visitor = visitors.find((item) => item.visitor_id === log.visitor_id)
            return (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm text-brass-50">{visitor?.full_name || log.visitor_id} <span className="font-mono text-xs text-white/40">{log.visitor_id}</span></p>
                  <p className="mt-1 text-xs text-white/45">
                    {log.receiver_name} · {log.detected_via} · {log.distance_m == null ? 'distance unavailable' : `${log.distance_m} m`}
                    {restrictedReceiverIds.has(log.receiver_id) && <span className="ml-2 text-rose-300">Restricted area</span>}
                  </p>
                </div>
                <time className="text-xs text-white/40">{parseApiTimestamp(log.timestamp).toLocaleString()}</time>
              </div>
            )
          }) : <p className="px-4 py-6 text-center text-sm text-white/35">No receiver proximity entries yet.</p>}
        </div>
      </div>
    </div>
  )
}
