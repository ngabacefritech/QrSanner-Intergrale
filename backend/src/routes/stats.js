/** Statistiques agrégées pour le dashboard + export CSV. */
import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

/** Série du nombre de scans par jour, jours sans activité inclus (à 0). */
function days(n) {
  const rows = db
    .prepare(
      `SELECT substr(scanned_at, 1, 10) AS day, COUNT(*) AS scans
       FROM scans
       WHERE substr(scanned_at, 1, 10) >= date('now', ?)
       GROUP BY day`
    )
    .all(`-${n - 1} day`);
  const counts = new Map(rows.map((r) => [r.day, r.scans]));
  const series = [];
  const dayMs = 86_400_000;
  const today = Math.floor(Date.now() / dayMs) * dayMs;
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = new Date(today - i * dayMs).toISOString().slice(0, 10);
    series.push({ day, scans: counts.get(day) ?? 0 });
  }
  return series;
}

export function statsRouter() {
  const router = Router();

  router.get('/', requireAdmin, (req, res) => {
    const daysSpan = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const total = db.prepare('SELECT COUNT(*) AS n FROM scans').get().n;
    const today = db.prepare(`SELECT COUNT(*) AS n FROM scans WHERE substr(scanned_at,1,10) = date('now')`).get().n;
    const campaignsTotal = db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n;
    const campaignsActive = db.prepare('SELECT COUNT(*) AS n FROM campaigns WHERE is_active = 1').get().n;

    const daily = days(daysSpan);
    const byPlatform = db
      .prepare('SELECT COALESCE(platform, ?) AS platform, COUNT(*) AS scans FROM scans GROUP BY platform ORDER BY scans DESC')
      .all('inconnu');
    const bySource = db.prepare("SELECT source, COUNT(*) AS scans FROM scans GROUP BY source ORDER BY scans DESC").all();
    const perCampaign = db
      .prepare(
        `SELECT c.id, c.title, c.is_active AS isActive, c.duration_seconds AS durationSeconds,
                COUNT(s.id) AS scans,
                MAX(s.scanned_at) AS lastScan
         FROM campaigns c LEFT JOIN scans s ON s.campaign_id = c.id
         GROUP BY c.id
         ORDER BY scans DESC, c.created_at DESC`
      )
      .all()
      .map((row) => ({ ...row, isActive: row.isActive === 1 }));

    res.json({
      totals: { scans: total, scansToday: today, campaigns: campaignsTotal, campaignsActive },
      daily,
      byPlatform,
      bySource,
      perCampaign,
    });
  });

  router.get('/export.csv', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT campaign_id, scanned_at, platform, app_version, source FROM scans ORDER BY scanned_at DESC').all();
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = ['campaign_id,scanned_at,platform,app_version,source']
      .concat(rows.map((r) => [r.campaign_id, r.scanned_at, r.platform, r.app_version, r.source].map(escape).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="qrscanner-scans-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  return router;
}
