
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(150)  NOT NULL,
  description   TEXT,
  location      VARCHAR(255)  NOT NULL,
  event_time    DATETIME      NOT NULL,
  created_by    INT           NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_creator
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_events_time (event_time),
  -- prevents the same event (same title, time, and location) from
  -- being created twice, by anyone
  UNIQUE KEY uq_event_title_time_location (title, event_time, location),
    -- one organizer can't run two different events at the same time+place
  UNIQUE KEY uq_owner_time_location (created_by, event_time, location)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rsvps (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_id      INT           NOT NULL,
  user_id       INT           NOT NULL,
  status        ENUM('going','maybe','declined') NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rsvps_event
    FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_rsvps_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  -- One RSVP per user per event.
  UNIQUE KEY uq_rsvp_event_user (event_id, user_id)
) ENGINE=InnoDB;
EOF

