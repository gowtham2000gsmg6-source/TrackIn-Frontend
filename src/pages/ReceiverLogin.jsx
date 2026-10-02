import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Radio, ShieldCheck } from 'lucide-react'
import { receiverLogin } from '../api/receivers'
import { apiErrorMessage } from '../api/client'

export default function ReceiverLogin() {
  const navigate = useNavigate()
  const [receiverId, setReceiverId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await receiverLogin(receiverId, pin)
      sessionStorage.setItem('mcet_receiver_token', session.access_token)
      sessionStorage.setItem('mcet_receiver_id', String(session.receiver_id))
      navigate('/receiver/dashboard', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in to this receiver.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Radio size={28} className="text-brass-400 mb-3" strokeWidth={1.5} />
          <h1 className="font-display text-2xl text-brass-50">Location Receiver</h1>
          <p className="text-sm text-white/40 mt-1">Dedicated receiver unit sign in</p>
        </div>
        <form onSubmit={handleSubmit} className="border border-white/10 bg-[#0D1521] px-6 py-7">
          <label className="ledger-label" htmlFor="receiver-id">Receiver ID</label>
          <input
            id="receiver-id"
            className="ledger-input mb-5"
            type="number"
            min="1"
            required
            value={receiverId}
            onChange={(event) => setReceiverId(event.target.value)}
            autoComplete="username"
          />
          <label className="ledger-label" htmlFor="receiver-pin">PIN</label>
          <input
            id="receiver-pin"
            className="ledger-input mb-6"
            type="password"
            minLength="6"
            maxLength="12"
            pattern="[0-9]{6,12}"
            inputMode="numeric"
            required
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="current-password"
          />
          {error && <p role="alert" className="text-signal-red text-sm mb-4">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Signing in…' : 'Sign in to receiver'}
          </button>
        </form>
        <Link className="block text-center text-xs text-white/40 hover:text-white/70 mt-5" to="/login">
          Admin and staff sign in
        </Link>
      </div>
    </div>
  )
}
