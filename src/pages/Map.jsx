import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-brass-50 flex items-center gap-2">
            <MapPin size={20} className="text-brass-400" strokeWidth={1.75} />
            Visitor Map
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Live positions from visitors who turned on location after scanning the gate QR code.
          </p>
        </div>
        <button onClick={load} className="btn-ghost text-xs">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {selected && (
        <div className="flex items-center justify-between border border-brass-400/30 bg-brass-400/5 px-4 py-2.5 mb-4 text-sm">
          <span className="text-brass-200">
            Focused on <span className="text-brass-50">{selected.full_name}</span>
            <span className="text-white/40 font-mono ml-2 text-xs">{selected.visitor_id}</span>
          </span>
          <button onClick={() => setSelectedId(null)} className="text-xs text-white/50 hover:text-white/80">
            Show all
          </button>
        </div>
      )}

      <div className="border border-white/10 overflow-hidden mb-6" style={{ height: 480 }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
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
                  {v.last_updated && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      updated {parseApiTimestamp(v.last_updated).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {receivers.filter((receiver) => receiver.status === 'active').map((receiver) => {
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
      </div>

      <div className="border border-white/10 mb-6">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm text-brass-50">Active receiver anchors ({receivers.filter((r) => r.status === 'active').length})</h2>
          <div className="flex gap-3 text-[11px] text-white/45">
            <span className="text-signal-red">Restricted</span>
            <span className="text-signal-green">Unrestricted</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {receivers.filter((r) => r.status === 'active').map((receiver) => (
            <div key={receiver.id} className="px-4 py-3">
              <p className={`text-sm ${receiver.is_restricted ? 'text-signal-red' : 'text-signal-green'}`}>
                {receiver.name} · {receiver.is_restricted ? 'Restricted' : 'Unrestricted'}
              </p>
              <p className="text-xs text-white/40 mt-1">{receiver.radius_m} m geofence · Receiver #{receiver.id}</p>
            </div>
          ))}
          {!receivers.some((r) => r.status === 'active') && (
            <p className="px-4 py-5 text-sm text-white/35">No active receiver anchors. Configure them under Location Receivers.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-brass-50">
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
                </div>
                <StatusBadge status={v.status} />
              </button>
            )) : (
              <p className="px-4 py-6 text-center text-sm text-white/35">No one is sharing location right now.</p>
            )}
          </div>
        </div>

          <div className="border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-brass-50">
            <WifiOff size={15} className="text-white/40" />
            <h2 className="text-sm">Location not on ({notLocated.length})</h2>
          </div>
          <div className="divide-y divide-white/10">
            {notLocated.length ? notLocated.map((v) => (
              <div key={v.visitor_id} className="flex items-center justify-between px-4 py-2.5 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm text-brass-50 truncate">{v.full_name}</p>
                  <p className="text-xs text-white/40 font-mono">{v.visitor_id} · {v.department}</p>
                </div>
                <StatusBadge status={v.status} />
              </div>
            )) : (
              <p className="px-4 py-6 text-center text-sm text-white/35">Everyone on campus is sharing location.</p>
            )}
          </div>
        </div>
      </div>

      <div className="border border-white/10 mt-6">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm">Recent receiver proximity entries</h2>
          <span className="text-[11px] text-white/35">GPS geofence transitions and receiver BLE reports</span>
        </div>
        <div className="divide-y divide-white/10">
          {logs.length ? logs.slice(0, 20).map((log) => {
            const visitor = visitors.find((item) => item.visitor_id === log.visitor_id)
            return (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm text-brass-50">{visitor?.full_name || log.visitor_id} <span className="font-mono text-xs text-white/40">{log.visitor_id}</span></p>
                  <p className="text-xs text-white/45 mt-1">{log.receiver_name} · {log.detected_via} · {log.distance_m == null ? 'distance unavailable' : `${log.distance_m} m`}</p>
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
