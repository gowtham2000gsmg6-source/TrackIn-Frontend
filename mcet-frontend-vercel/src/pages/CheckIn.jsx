import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, UserPlus, QrCode, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { checkIn } from '../api/visitors'
import { apiErrorMessage } from '../api/client'

const EMPTY = {
  full_name: '',
  phone_number: '',
  email: '',
  department: '',
  person_to_meet: '',
  purpose: '',
  device_info: '',
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

const selfCheckInUrl = `${window.location.origin}/visit`

export default function CheckIn() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(selfCheckInUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — copy it manually')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((err) => ({ ...err, [name]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Visitor name is required.'
    if (!form.phone_number.trim()) e.phone_number = 'Phone number is required.'
    else if (form.phone_number.trim().length < 10) e.phone_number = 'Enter at least 10 digits.'
    if (!form.department.trim()) e.department = 'Host department is required.'
    if (!form.person_to_meet.trim()) e.person_to_meet = 'Who they are meeting is required.'
    if (!form.purpose.trim()) e.purpose = 'Purpose of visit is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        email: form.email.trim() || undefined,
        device_info: form.device_info.trim() || undefined,
      }
      const visitor = await checkIn(payload)
      toast.success(`Checked in — ${visitor.visitor_id}`)
      setForm(EMPTY)
      navigate('/active')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Check-in failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-1 text-brass-400">
        <UserPlus size={18} strokeWidth={1.75} />
        <h1 className="font-display text-2xl text-brass-50">Visitor Check-In</h1>
      </div>
      <p className="text-sm text-white/40 mb-8">Log a walk-in visitor at the gate, or let them check themselves in.</p>

      <div className="border border-white/10 bg-[#0D1521] p-6 mb-8 flex flex-col sm:flex-row items-center gap-6">
        <div className="bg-white p-2 shrink-0">
          <QRCodeSVG value={selfCheckInUrl} size={112} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-brass-400 mb-1">
            <QrCode size={16} strokeWidth={1.75} />
            <h2 className="text-sm text-brass-50">Visitor Self Check-In</h2>
          </div>
          <p className="text-xs text-white/40 mb-3">
            Display this at the gate. Visitors scan it on their own phone, enter their details — no login required —
            and can turn on location so you can see them on the Visitor Map.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-brass-100/80 bg-white/5 px-2 py-1 truncate">{selfCheckInUrl}</code>
            <button onClick={copyLink} className="btn-ghost text-xs px-2.5 py-1.5 shrink-0">
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border border-white/10 bg-[#0D1521] p-6 space-y-5">
        <Field label="Visitor Name" name="full_name" value={form.full_name} onChange={handleChange}
          error={errors.full_name} placeholder="Full name" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone Number" name="phone_number" value={form.phone_number} onChange={handleChange}
            error={errors.phone_number} placeholder="98765 43210" />
          <Field label="Email (optional)" name="email" value={form.email} onChange={handleChange}
            placeholder="name@example.com" type="email" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Host Department" name="department" value={form.department} onChange={handleChange}
            error={errors.department} placeholder="Computer Science" />
          <Field label="Person to Meet" name="person_to_meet" value={form.person_to_meet} onChange={handleChange}
            error={errors.person_to_meet} placeholder="Dr. Ramasamy (HOD)" />
        </div>
        <Field label="Purpose of Visit" name="purpose" value={form.purpose} onChange={handleChange}
          error={errors.purpose} placeholder="Guest lecture, project review, etc." />
        <Field label="Vehicle Number (optional)" name="device_info" value={form.device_info} onChange={handleChange}
          placeholder="TN 45 AB 1234" />

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Checking in…' : 'Check In Visitor'}
        </button>
      </form>
    </div>
  )
}
