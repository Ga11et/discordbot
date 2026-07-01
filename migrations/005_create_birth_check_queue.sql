CREATE TABLE IF NOT EXISTS birth_check_queue (
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS birth_check_queue_guild_id_idx ON birth_check_queue (guild_id);
