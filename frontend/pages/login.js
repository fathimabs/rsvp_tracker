import { useState } from 'react'
import { useRouter } from 'next/router'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('alice@example.com')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { token, user } = await api.login(email, password)
      login(token, user)
      router.push('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h2>Log in</h2>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="meta" style={{ marginTop: 24 }}>
        Registration is disabled — demo accounts (password: password123):
        <br />alice@example.com · bob@example.com · priya@example.com
      </p>
    </div>
  )
}
