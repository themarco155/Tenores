CREATE TABLE rehearsals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,
  note        TEXT NOT NULL DEFAULT '',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE attendance (
  rehearsal_id INTEGER NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (rehearsal_id, user_id)
);
CREATE INDEX attendance_user ON attendance(user_id);
