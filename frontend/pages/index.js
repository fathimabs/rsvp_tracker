import { useEffect, useState } from 'react'
import Link from 'next/link'
import RequireAuth from '../components/RequireAuth'
import { api } from '../lib/api'

function EventsList() {
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(term) {
    setLoading(true)
    setError('')
    try {
      const data = await api.listEvents(term)
      setEvents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  return (
    <div className="container">
      <div className="top-bar">
        <h2>Upcoming Meetups</h2>
        <Link href="/events/new"><button>+ New Event</button></Link>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Search by title or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ margin: 0 }}
        />
        <button type="submit" style={{ height: 42 }}>Search</button>
      </form>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading events…</p>}
      {!loading && events.length === 0 && <p>No events found.</p>}

      {events.map((ev) => (
        <Link key={ev.id} href={`/events/${ev.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <h3>{ev.title}</h3>
            <p className="meta">📍 {ev.location}</p>
            <p className="meta">🕒 {new Date(ev.event_time).toLocaleString()}</p>
            <p className="meta">Organized by {ev.organizer_name} · {ev.going_count} going</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <RequireAuth>
      <EventsList />
    </RequireAuth>
  )
}
