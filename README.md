# Local Meetup RSVP Tracker

Full-stack app: Next.js (frontend) + Express/Node.js (API) + MySQL (storage), fully containerized.

## Run it

```bash
docker compose up
```

One command boots MySQL, runs the schema, seeds demo users, starts the API, and builds/serves the frontend.

- Frontend: http://localhost:3000
- API: http://localhost:4000/api
- MySQL: localhost:3306 (`rsvp_user` / `rsvp_pass`, db `rsvp_tracker`)

**Note on first boot:** MySQL's first-time initialization (creating the schema, applying `init.sql`) can take a couple of minutes depending on your machine — the backend will log `MySQL not ready yet` retries while it waits, which is expected. Subsequent runs (without wiping the volume) start in seconds.

### Demo accounts (registration is intentionally disabled per the requirement)

| Email | Password |
|---|---|
| alice@example.com | password123 |
| bob@example.com | password123 |
| priya@example.com | password123 |

To fully reset all data, run `docker compose down -v` then `docker compose up` again.

---

## Architecture

```
frontend/   Next.js (Pages Router). Calls the API directly from the browser
            using a JWT stored in localStorage.
            
backend/    Express API. Stateless — every protected request must carry
            "Authorization: Bearer <token>".
            
db/         init.sql — schema only, applied automatically by MySQL on
            first boot via /docker-entrypoint-initdb.d.
```


## Schema

```
users   (id, name, email UNIQUE, password_hash, created_at)
events  (id, title, description, location, event_time, created_by -> users.id, ...)
rsvps   (id, event_id -> events.id, user_id -> users.id, status ENUM, ...)
```

- `events.created_by` and both `rsvps` foreign keys are `ON DELETE CASCADE` — deleting an event or user cleans up dependent rows automatically

- `rsvps` has `UNIQUE(event_id, user_id)`. A user can only ever have one RSVP per event — re-RSVPing does an `INSERT ... ON DUPLICATE KEY UPDATE`  rather than creating a duplicate/conflicting row. Users can freely change their status (going/maybe/declined) at any time — this mirrors how RSVP tools like Google Calendar work, and the assignment doesn't ask for statuses to be locked.

- **Duplicate-event prevention (design decision beyond the base spec):** two extra unique constraints on `events`:
  - `UNIQUE(title, event_time, location)` — the same event (same title, date/time, and location) can't be created twice, by anyone.
  
  - `UNIQUE(created_by, event_time, location)` — one organizer can't create two *different* events at the same date/time and location, since that's physically impossible for one person to run.
  
  Both are enforced at the database level, not just checked in application code. The API catches MySQL's `ER_DUP_ENTRY` error and returns a clear `409 Conflict` with a specific message for each case.

### Auth & ownership enforcement

- Login (`POST /api/auth/login`) checks the password against a **bcrypt** hash and returns a **JWT** (2h expiry).

- Every route except `/auth/login` runs a `requireAuth` middleware that verifies the JWT. No valid token → `401`.

- Ownership (edit/delete an event) is a **separate, per-resource check**: each `PUT`/`DELETE` on `/events/:id` loads the event fresh from the DB and compares `event.created_by` to `req.user.id`. Mismatch → `403`.

- This is enforced **server-side**. The frontend also hides the "Delete" button from non-owners, the real security boundary is the backend, not the browser.

### API

**Auth**

- `POST /api/auth/login` — no auth required, returns `{ token, user }`

- `GET /api/auth/me` — requires auth, returns the current user from the token

**Events**

- `GET /api/events` — requires auth, list all events, supports `?search=` on title/location

- `GET /api/events/:id` — requires auth, full event detail + all RSVPs + `myRsvp`

- `POST /api/events` — requires auth, create an event; returns 409 on duplicate event or double-booking

- `PUT /api/events/:id` — requires auth + must be the creator, edit an event; same 409 checks apply

- `DELETE /api/events/:id` — requires auth + must be the creator, deletes the event (RSVPs cascade automatically)

- `POST /api/events/:id/rsvp` — requires auth, body `{ status }`, upserts the caller's RSVP

Errors return `{ "error": "message" }` with an appropriate status code (400 validation, 401 auth, 403 ownership, 404 not found, 409 conflict, 500 unexpected).

### Docker boot sequence

1. `mysql` starts and runs `db/init.sql` on first boot only (via `/docker-entrypoint-initdb.d`), then reports healthy via `mysqladmin ping`.

2. `backend` starts as soon as the `mysql` container has started , then its own `waitForDb()` retry loop handles waiting for MySQL to actually be queryable, with generous patience (up to ~4 minutes) since MySQL's official image restarts itself internally during first-time setup.

3. Once connected, the backend seeds 3 demo users (bcrypt-hashed) and starts listening.

4. `frontend` builds against the backend's public URL and starts.

### Known trade-offs (given the timeline)

- No pagination on the events list.

- No rate limiting on `/auth/login`.

- No refresh tokens — a 2h JWT is simple and sufficient for this scope.

- **MySQL first-boot timing:** discovered during testing that the official MySQL image runs a temporary internal server before the real one on first init, which can take 1-4+ minutes depending on the machine. Rather than tightly coupling `docker-compose.yml`'s `depends_on` to a healthcheck (which is fragile — I initially hit real failures where the healthcheck passed during the temporary server's brief window, then the backend's connection attempts failed when MySQL restarted moments later), I decoupled the backend's startup from the healthcheck and gave its own retry loop enough patience to survive the full cycle. Styling is intentionally minimal per the brief ("doesn't need to be polished").
