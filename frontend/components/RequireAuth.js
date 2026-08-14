import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/AuthContext';

// client-side redirect only — a UX convenience, NOT the real security
// boundary. The backend's auth middleware is what actually rejects
// unauthorized requests, since anything client-side can be bypassed.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="container">Loading…</div>;
  }

  return children;
}
