import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import RequireAuth from '../../components/RequireAuth'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/AuthContext'

const STATUSES = ['going', 'maybe', 'declined']

function EventDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useAuth()

  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const data = await api.getEvent(id)
      setEvent(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (id) load()
  }, [id])

  async function handleRsvp(status) {
    setRsvpSubmitting(true)
    setError('')
    try {
      await api.rsvp(id, status)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRsvpSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this event? This cannot be undone.')) return
    setDeleting(true)
    try {
      await api.deleteEvent(id)
      router.push('/')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (error && !event) {
    return (
      <div className="container">
        <div className="error-banner">{error}</div>
      </div>
    )
  }

  if (!event) {
    return <div className="container">Loading…</div>
  }

  const isOwner = user && user.id === event.created_by
  const grouped = { going: [], maybe: [], declined: [] }
  event.rsvps.forEach((r) => grouped[r.status]?.push(r))

  return (
    <div className="container">
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="top-bar">
          <h2 style={{ margin: 0 }}>{event.title}</h2>
          {isOwner && (
            <button className="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Event'}
            </button>
          )}
        </div>

        <p className="meta">📍 {event.location}</p>
        <p className="meta">🕒 {new Date(event.event_time).toLocaleString()}</p>
        <p className="meta">Organized by {event.organizer_name}</p>
        {event.description && <p>{event.description}</p>}

        <h4>Your RSVP</h4>
        <div className="rsvp-row">
          {STATUSES.map((status) => (
            <button
              key={status}
              className={event.myRsvp?.status === status ? 'active' : 'secondary'}
              disabled={rsvpSubmitting}
              onClick={() => handleRsvp(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h4>Who's coming ({grouped.going.length} going · {grouped.maybe.length} maybe · {grouped.declined.length} declined)</h4>
        {event.rsvps.length === 0 && <p className="meta">No RSVPs yet.</p>}
        {event.rsvps.map((r) => (
          <div key={r.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span>{r.name}</span>
            <span className={`badge ${r.status}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EventPage() {
  return (
    <RequireAuth>
      <EventDetail />
    </RequireAuth>
  )
}
