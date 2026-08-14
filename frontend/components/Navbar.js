import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav>
      <Link href="/">Local Meetup RSVP Tracker</Link>
      <div className="links">
        {user ? (
          <>
            <Link href="/events/new">+ New Event</Link>
            <span>{user.name}</span>
            <button className="secondary" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </div>
    </nav>
  );
}

