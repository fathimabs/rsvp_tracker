require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { waitForDb } = require('./db/pool');
const { seedUsers } = require('./db/seed');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Centralized error handler so route handlers can stay simple and any
// unexpected/async error still returns a clean JSON response instead of
// an HTML stack trace or a hung connection.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  // Table creation itself is handled by MySQL running db/init.sql on
  // first boot (mounted into docker-entrypoint-initdb.d). Here we just
  // wait until the DB is actually queryable, then seed demo users.
  await waitForDb();
  await seedUsers();

  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
