export const COLLECTIONS = ['networks','houses','meeting_reports','communications','materials','pastoral_contacts','admin_access','app_config'];
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
 collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(collection,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS house_code ON records(json_extract(data,'$.code')) WHERE collection='houses';
CREATE UNIQUE INDEX IF NOT EXISTS meeting_house_date ON records(json_extract(data,'$.house_id'),json_extract(data,'$.meeting_date')) WHERE collection='meeting_reports';
CREATE TABLE IF NOT EXISTS stored_files (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
 checksum TEXT NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS migration_state (id INTEGER PRIMARY KEY CHECK(id=1), ready INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO migration_state(id,ready) VALUES(1,0);
`;
