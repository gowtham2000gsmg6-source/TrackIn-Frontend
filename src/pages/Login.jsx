import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import { apiErrorMessage } from '../api/client'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setLoading(true)
    try {
      await signIn(username.trim(), password)
      toast.success('Signed in')
      navigate('/')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in. Check your credentials.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={28} className="text-brass-400 mb-3" strokeWidth={1.5} />
          <h1 className="font-display text-2xl text-brass-50">MCET Gate</h1>
          <p className="text-sm text-white/40 mt-1">Visitor Tracking — Staff Sign In</p>
        </div>

        <form onSubmit={handleSubmit} className="border border-white/10 bg-[#0D1521] px-6 py-7">
          <div className="mb-5">
            <label className="ledger-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="ledger-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="mb-6">
            <label className="ledger-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="ledger-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-signal-red text-sm mb-4">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-white/30 mt-5 text-center">
            Seeded account: <span className="font-mono text-white/50">admin / admin123</span>
          </p>
        </form>
      </div>
    </div>
  )
}
