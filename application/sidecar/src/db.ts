import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"

const sqlite = new Database("dev.db")

sqlite.run(`
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    browser_type TEXT NOT NULL,
    url TEXT NOT NULL,
    hostname TEXT NOT NULL,
    pathname TEXT NOT NULL,
    meta TEXT,
    duration_ms INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    matched_rules TEXT NOT NULL,
    primary_rule_id TEXT,
    recorded_at INTEGER DEFAULT (strftime('%s', 'now'))
)
`)

export const db = drizzle(sqlite)