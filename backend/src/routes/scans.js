/**
 * Enregistrement des scans (depuis le mobile, optionnel) et historique.
 * Limite anti-abus simple : 120 événements/min/ip (un scan toutes les ~0,5 s).
 */
import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const buckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    buckets.set(ip, list);
    return true;
  }
  list.push(now);
  buckets.set(ip, list);
  return false;
}

export function scansRouter() {
  const router = Router();

  router.post('/', (req, res) => {
    const ip = req.ip ?? 'inconnu';
    if (rateLimited(ip)) return res.status(429).json({ error: 'Trop de scans enregistrés, réessayez dans une minute.' });

    const body = req.body ?? {};
    const campaignId = String(body.campaignId ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{3,20}$/.test(campaignId)) return res.status(422).json({ error: 'campaignId invalide.' });

    const exists = db.prepare('SELECT id, is_active FROM campaigns WHERE id = ?').get(campaignId);
    if (!exists) return res.status(404).json({ error: 'Campagne inconnue.' });
    if (exists.is_active !== 1) return res.status(422).json({ error: 'Campagne inactive.' });

    const source = ['embedded', 'registry', 'direct-url', 'unknown'].includes(body.source) ? body.source : 'unknown';
    const platform = typeof body.platform === 'string' && /^(ios|android|other|web)$/.test(body.platform.toLowerCase()) ? body.platform.toLowerCase() : null;
    const appVersion = typeof body.appVersion === 'string' ? body.appVersion.slice(0, 20) : null;
    const at = typeof body.scannedAt === 'string' && !Number.isNaN(Date.parse(body.scannedAt)) ? new Date(body.scannedAt).toISOString() : new Date().toISOString();

    db.prepare('INSERT INTO scans (campaign_id, scanned_at, platform, app_version, source) VALUES (?,?,?,?,?)')
      .run(campaignId, at, platform, appVersion, source);

    res.status(201).json({ recorded: true });
  });

  router.get('/:campaignId', requireAdmin, (req, res) => {
    const id = req.params.campaignId.toUpperCase();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const rows = db.prepare('SELECT scanned_at, platform, app_version, source FROM scans WHERE campaign_id = ? ORDER BY scanned_at DESC LIMIT ?').all(id, limit);
    res.json({ campaignId: id, total: countFor(id), scans: rows });
  });

  return router;
}

function countFor(campaignId) {
  return db.prepare('SELECT COUNT(*) AS n FROM scans WHERE campaign_id = ?').get(campaignId)?.n ?? 0;
}
