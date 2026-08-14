const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All routes here require a valid logged-in user — browsing, creating,
// and RSVPing are all "registered users only" per the assignment.
router.use(requireAuth);

// GET /api/events?search=foo
// Browse all events, with the organizer's name and a running "going"
// count so the list is useful without opening each event.
router.get('/', async (req, res) => {
  const { search } = req.query;

  let sql = `
    SELECT
      e.id, e.title, e.description, e.location, e.event_time,
      e.created_by, u.name AS organizer_name,
      (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count
    FROM events e
    JOIN users u ON u.id = e.created_by
  `;
  const params = [];

  if (search) {
    sql += ' WHERE e.title LIKE ? OR e.location LIKE ? ';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY e.event_time ASC';

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

// GET /api/events/:id
// Full detail for one event, plus every RSVP with the responder's name,
// so "see who's attending" is answered in a single request.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const [eventRows] = await pool.query(
    `SELECT e.*, u.name AS organizer_name
     FROM events e JOIN users u ON u.id = e.created_by
     WHERE e.id = ?`,
    [id]
  );
  const event = eventRows[0];

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const [rsvps] = await pool.query(
    `SELECT r.status, r.updated_at, u.id AS user_id, u.name
     FROM rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ?
     ORDER BY r.updated_at DESC`,
    [id]
  );

  const myRsvp = rsvps.find((r) => r.user_id === req.user.id) || null;

  res.json({ ...event, rsvps, myRsvp });
});

// POST /api/events
router.post('/', async (req, res) => {
  const { title, description, location, event_time } = req.body || {};

  if (!title || !location || !event_time) {
    return res.status(400).json({ error: 'title, location, and event_time are required' });
  }

  const [result] = await pool.query(
    `INSERT INTO events (title, description, location, event_time, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [title, description || null, location, event_time, req.user.id]
  );

  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// Shared ownership check used by both PUT and DELETE below. Loaded
// fresh from the DB each time — never trust an ownership claim baked
// into the request body or a stale value from the client.
async function loadOwnedEvent(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
  const event = rows[0];

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return null;
  }
  if (event.created_by !== req.user.id) {
    // 403, not 404: the event exists, the user just isn't allowed to
    // touch it. This is enforced server-side regardless of what the
    // UI shows/hides, since UI-only checks are trivially bypassed.
    res.status(403).json({ error: 'Only the event creator can modify this event' });
    return null;
  }
  return event;
}

// PUT /api/events/:id — creator only
router.put('/:id', async (req, res) => {
  const event = await loadOwnedEvent(req, res);
  if (!event) return;

  const { title, description, location, event_time } = req.body || {};

  await pool.query(
    `UPDATE events
     SET title = ?, description = ?, location = ?, event_time = ?
     WHERE id = ?`,
    [
      title ?? event.title,
      description ?? event.description,
      location ?? event.location,
      event_time ?? event.event_time,
      event.id
    ]
  );

  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [event.id]);
  res.json(rows[0]);
});

// DELETE /api/events/:id — creator only
// RSVPs for this event are removed automatically via ON DELETE CASCADE
// on rsvps.event_id, so no orphaned RSVP rows are left behind.
router.delete('/:id', async (req, res) => {
  const event = await loadOwnedEvent(req, res);
  if (!event) return;

  await pool.query('DELETE FROM events WHERE id = ?', [event.id]);
  res.status(204).send();
});

// POST /api/events/:id/rsvp  { status: 'going' | 'maybe' | 'declined' }
// Upsert: a user can only ever have one RSVP row per event (enforced by
// the DB's UNIQUE(event_id, user_id) constraint, not just app logic),
// so re-RSVPing updates the existing row instead of creating a duplicate.
router.post('/:id/rsvp', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const validStatuses = ['going', 'maybe', 'declined'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const [eventRows] = await pool.query('SELECT id FROM events WHERE id = ?', [id]);
  if (!eventRows[0]) {
    return res.status(404).json({ error: 'Event not found' });
  }

  await pool.query(
    `INSERT INTO rsvps (event_id, user_id, status)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [id, req.user.id, status]
  );

  const [rows] = await pool.query(
    'SELECT * FROM rsvps WHERE event_id = ? AND user_id = ?',
    [id, req.user.id]
  );
  res.status(200).json(rows[0]);
});

module.exports = router;
