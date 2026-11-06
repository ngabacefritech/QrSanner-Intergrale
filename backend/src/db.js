/**
 * Base SQLite (better-sqlite3, WAL). Le fichier vit dans backend/data/.
 * Schéma volontairement minimal : campagnes + événements de scan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'qrscanner.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS campaigns (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  media_type        TEXT NOT NULL CHECK (media_type IN ('image','video')),
  media_url         TEXT NOT NULL,
  fallback_url      TEXT,
  duration_seconds  INTEGER NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
  is_active         INTEGER NOT NULL DEFAULT 1,
  allow_early_skip  INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  TEXT NOT NULL,
  scanned_at   TEXT NOT NULL,
  platform     TEXT,
  app_version  TEXT,
  source       TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_scans_campaign ON scans (campaign_id);
CREATE INDEX IF NOT EXISTS idx_scans_day ON scans (scanned_at);
`);

export function rowToCampaign(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    fallbackUrl: row.fallback_url ?? null,
    durationSeconds: row.duration_seconds,
    isActive: row.is_active === 1,
    allowEarlySkip: row.allow_early_skip === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
