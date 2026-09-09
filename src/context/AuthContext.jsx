import React, { createContext, useContext, useState, useCallback } from 'react'
import * as api from '../api/visitors'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('mcet_token'))
  const [role, setRole] = useState(() => localStorage.getItem('mcet_role'))
  const [username, setUsername] = useState(() => localStorage.getItem('mcet_username'))

  const signIn = useCallback(async (user, pass) => {
    const data = await api.login(user, pass)
    localStorage.setItem('mcet_token', data.access_token)
    localStorage.setItem('mcet_role', data.role)
    localStorage.setItem('mcet_username', user)
    setToken(data.access_token)
    setRole(data.role)
    setUsername(user)
    return data
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem('mcet_token')
    localStorage.removeItem('mcet_role')
    localStorage.removeItem('mcet_username')
    setToken(null)
    setRole(null)
    setUsername(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, role, username, signIn, signOut, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
