CREATE TABLE IF NOT EXISTS birthday_gratz_log (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS birthday_gratz_log_target_created_idx
  ON birthday_gratz_log (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS birthday_gratz_log_created_at_idx
  ON birthday_gratz_log (created_at DESC);
