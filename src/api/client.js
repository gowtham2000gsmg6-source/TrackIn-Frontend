import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
})

// Attach the JWT to every outgoing request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mcet_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On a 401 (expired/invalid token), clear the session and bounce to /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mcet_token')
      localStorage.removeItem('mcet_role')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function apiErrorMessage(error, fallback = 'Something went wrong. Try again.') {
  return error?.response?.data?.detail || error?.message || fallback
}

export function parseApiTimestamp(value) {
  if (!value) return null
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`
  return new Date(timestamp)
}

// A second, "bare" axios instance for the public visitor self-check-in flow.
// It must NOT auto-attach an admin token (a gate-staff member could be signed
// in on the same browser), so the visitor's own short-lived token is passed
// explicitly per-request instead.
export const visitorApi = axios.create({
  baseURL: BASE_URL,
})
