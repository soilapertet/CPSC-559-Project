import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useUser } from '../context/UserContext'

// Handles login-then-register flow.
// Step 1: user enters username or email to login.
// Step 2: if not found, shows register form.
// Props: onSuccess() called after successful auth.
export default function AuthModal({ onSuccess }) {
  const { login, register } = useUser()
  const [step, setStep] = useState('login') // 'login' | 'register'
  const [identifier, setIdentifier] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', userName: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState(null)

  async function handleLogin() {
    setError('')
    if (!identifier.trim()) {
      setError('Please enter a username or email.')
      return
    }
    setLoading(true)
    try {
      await login(identifier.trim())
      onSuccess()
    } catch (err) {
      const status = err.response?.status
      if (status === 404) {
        setStep('register')
        setForm(f => ({ ...f, userName: identifier.trim() }))
      } else if (!err.response) {
        setError('Cannot reach the server.')
      } else {
        setError(err.response?.data?.error || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    setError('')

    // Generate request id for register request (only one)
    let id = requestId;
    if (!id) {
      id = uuidv4();
      setRequestId(id);
    }

    const { firstName, lastName, userName, email } = form
    if (!firstName.trim() || !lastName.trim() || !userName.trim() || !email.trim()) {
      setError('All fields are required.')
      return
    }
    setLoading(true)
    try {
      await register(firstName.trim(), lastName.trim(), userName.trim(), email.trim(), id)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'register') {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Account</h2>
        <p className="text-sm text-gray-500 mb-4">
          No account found for <span className="font-medium">"{identifier}"</span>. Fill in your details to register.
        </p>
        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder="First name"
            value={form.firstName}
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          <input
            type="text"
            placeholder="Last name"
            value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="text"
            placeholder="Username"
            value={form.userName}
            onChange={e => setForm(f => ({ ...f, userName: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { setStep('login'); setError('') }}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleRegister}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign In</h2>
      <p className="text-sm text-gray-500 mb-4">Enter your username or email to continue.</p>
      <input
        type="text"
        value={identifier}
        onChange={e => setIdentifier(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        placeholder="Username or email"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        autoFocus
      />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
      >
        {loading ? 'Checking...' : 'Continue'}
      </button>
    </div>
  )
}
