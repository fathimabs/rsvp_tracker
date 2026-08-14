const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

// Assignment says "ignore registration, seed some users" — so instead of
// hardcoding a bcrypt hash string into init.sql (which would be an
// unreadable magic value), we hash these at startup in code and insert
// them only if the users table is empty. Safe to run on every boot.
const SEED_USERS = [
  { name: 'Alice Johnson', email: 'alice@example.com', password: 'password123' },
  { name: 'Bob Martinez', email: 'bob@example.com', password: 'password123' },
  { name: 'Priya Nair', email: 'priya@example.com', password: 'password123' }
];

async function seedUsers() {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (rows[0].count > 0) {
    console.log('Users already seeded, skipping.');
    return;
  }

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [user.name, user.email, passwordHash]
    );
  }
  console.log(`Seeded ${SEED_USERS.length} demo users (password for all: "password123").`);
}

module.exports = { seedUsers };
