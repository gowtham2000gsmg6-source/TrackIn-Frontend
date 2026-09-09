import { api, visitorApi } from './client'

export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)

export const getDashboard = () => api.get('/admin/dashboard').then((r) => r.data)

export const checkIn = (payload) => api.post('/visitors/check-in', payload).then((r) => r.data)

export const checkOut = (visitorId) =>
  api.post(`/visitors/check-out/${visitorId}`).then((r) => r.data)

// Admin approves a self-registered ("Pending Entry") visitor onto campus.
export const admitVisitor = (visitorId) =>
  api.post(`/visitors/admit/${visitorId}`).then((r) => r.data)

export const getActive = () => api.get('/visitors/active').then((r) => r.data)

export const getHistory = (params) => api.get('/visitors/history', { params }).then((r) => r.data)

// Live locations of everyone currently on campus / pending entry — used by the Map view.
export const getLiveAll = () => api.get('/visitors/live/all').then((r) => r.data)

// ---------- Public visitor self-check-in (no login, QR / link based) ----------

// Visitor fills the form themselves; no admin/visitor role picker — this is
// always a visitor. Returns { visitor_id, full_name, access_token }.
export const registerVisitor = (payload) =>
  visitorApi.post('/visitors/register', payload).then((r) => r.data)

// Push a single GPS reading, authenticated with the visitor's own short-lived
// token (never the admin's token from localStorage).
export const pushLocation = (visitorToken, payload) =>
  visitorApi
    .post('/visitors/location', payload, {
      headers: { Authorization: `Bearer ${visitorToken}` },
    })
    .then((r) => r.data)
