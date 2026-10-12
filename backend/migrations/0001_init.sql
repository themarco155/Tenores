CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name    TEXT NOT NULL,
  pin_hash        TEXT NOT NULL,
  pin_salt        TEXT NOT NULL,
  pin_iterations  INTEGER NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('tenor','admin')),
  active          INTEGER NOT NULL DEFAULT 1,
  must_change_pin INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deactivated_at  TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE login_failures (
  username     TEXT PRIMARY KEY COLLATE NOCASE,
  failed_count INTEGER NOT NULL,
  locked_until TEXT
);

CREATE TABLE attempts (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id         TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('guide','test')),
  phrase_from     INTEGER NOT NULL,
  phrase_to       INTEGER NOT NULL,
  is_full         INTEGER NOT NULL,
  score_total     INTEGER NOT NULL,
  score_pitch     INTEGER NOT NULL,
  score_rhythm    INTEGER NOT NULL,
  score_stability INTEGER,
  coverage        REAL NOT NULL,
  phrase_scores   TEXT NOT NULL,
  tips            TEXT NOT NULL,
  engine_version  TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX attempts_user_song ON attempts(user_id, song_id, created_at);
CREATE INDEX attempts_ranking   ON attempts(song_id, mode, is_full, created_at);
