CREATE TABLE IF NOT EXISTS kick_queue (
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS kick_queue_guild_id_idx ON kick_queue (guild_id);
