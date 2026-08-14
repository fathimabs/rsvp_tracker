
const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/events?search=foo
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
// MySQL's duplicate-key rejection when title+event_time+location already exists — same event, same slot, can't be created twice by anyone.
router.post('/', async (req, res) => {
  const { title, description, location, event_time } = req.body || {};

  if (!title || !location || !event_time) {
    return res.status(400).json({ error: 'title, location, and event_time are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO events (title, description, location, event_time, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, description || null, location, event_time, req.user.id]
    );

    const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage?.includes('uq_owner_time_location')) {
        return res.status(409).json({
          error: 'You already have an event at this date, time, and location'
        });
      }
      return res.status(409).json({
        error: 'An event with this title, date/time, and location already exists'
      });
    }
    throw err;
  }
});
async function loadOwnedEvent(req, res) {
  const { id } = req.params;
  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [id]);
  const event = rows[0];

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return null;
  }
  if (event.created_by !== req.user.id) {
    res.status(403).json({ error: 'Only the event creator can modify this event' });
    return null;
  }
  return event;
}

// PUT /api/events/:id — creator only. Also duplicate-checked, 
router.put('/:id', async (req, res) => {
  const event = await loadOwnedEvent(req, res);
  if (!event) return;

  const { title, description, location, event_time } = req.body || {};

  try {
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
  }  catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage?.includes('uq_owner_time_location')) {
        return res.status(409).json({
          error: 'You already have an event at this date, time, and location'
        });
      }
      return res.status(409).json({
        error: 'An event with this title, date/time, and location already exists'
      });
    }
    throw err;
  }
});

// DELETE /api/events/:id — creator only
router.delete('/:id', async (req, res) => {
  const event = await loadOwnedEvent(req, res);
  if (!event) return;

  await pool.query('DELETE FROM events WHERE id = ?', [event.id]);
  res.status(204).send();
});

// POST /api/events/:id/rsvp  { status: 'going' | 'maybe' | 'declined' }
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

