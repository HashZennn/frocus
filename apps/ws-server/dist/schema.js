"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessions = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.sessions = (0, sqlite_core_1.sqliteTable)("sessions", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    clientId: (0, sqlite_core_1.text)("client_id").notNull(),
    browserType: (0, sqlite_core_1.text)("browser_type").notNull(),
    url: (0, sqlite_core_1.text)("url").notNull(),
    hostname: (0, sqlite_core_1.text)("hostname").notNull(),
    pathname: (0, sqlite_core_1.text)("pathname").notNull(),
    meta: (0, sqlite_core_1.text)("meta"),
    durationMs: (0, sqlite_core_1.integer)("duration_ms").notNull(),
    startedAt: (0, sqlite_core_1.integer)("started_at", { mode: "timestamp" }).notNull(),
    endedAt: (0, sqlite_core_1.integer)("ended_at", { mode: "timestamp" }).notNull(),
    matchedRules: (0, sqlite_core_1.text)("matched_rules").notNull(),
    primaryRuleId: (0, sqlite_core_1.text)("primary_rule_id"),
    recordedAt: (0, sqlite_core_1.integer)("recorded_at", { mode: "timestamp" }).defaultNow()
});
