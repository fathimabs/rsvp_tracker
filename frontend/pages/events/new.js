import { useState } from 'react'
import { useRouter } from 'next/router'
import RequireAuth from '../../components/RequireAuth'
import { api } from '../../lib/api'

function NewEventForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const event = await api.createEvent({
        title,
        description,
        location,
        event_time: eventTime
      })
      router.push(`/events/${event.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 500 }}>
      <h2>Create a Meetup</h2>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label>Description</label>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} required />

        <label>Date &amp; Time</label>
        <input
          type="datetime-local"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </div>
  )
}

export default function NewEvent() {
  return (
    <RequireAuth>
      <NewEventForm />
    </RequireAuth>
  )
}
