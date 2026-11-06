/** Routes des campagnes : CRUD admin + liste publique pour le mobile. */
import { Router } from 'express';
import { db, rowToCampaign } from '../db.js';
import { buildPayload, generateCampaignId } from '../payload.js';
import { requireAdmin } from '../middleware/auth.js';

export function campaignsRouter() {
  const router = Router();

  function withQrText(campaign) {
    const built = buildPayload({ ...campaign, id: campaign.id });
    return { ...campaign, qrText: built.ok ? built.qrText : null, qrBytes: built.ok ? built.bytes : null };
  }

  // Publique (montée sur /api/campaigns) : campagnes actives, prêtes à être
  // embarquées dans l'app mobile (mode « registre distant »).
  router.public = Router();
  router.public.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM campaigns WHERE is_active = 1 ORDER BY created_at DESC').all();
    res.json({ campaigns: rows.map((r) => withQrText(rowToCampaign(r))) });
  });

  router.get('/', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
    res.json({ campaigns: rows.map((r) => withQrText(rowToCampaign(r))) });
  });

  // (l'endpoint /:id admin est supprimé : le dashboard liste tout en un appel)

  router.post('/', requireAdmin, (req, res) => {
    const body = req.body ?? {};
    const id = String(body.id ?? '').trim().toUpperCase() || generateCampaignId();
    const built = buildPayload({ ...body, id });
    if (!built.ok) return res.status(422).json({ errors: built.errors });

    const now = new Date().toISOString();
    const exists = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(id);
    if (exists) return res.status(409).json({ error: `L'identifiant ${id} existe déjà.` });

    db.prepare(
      `INSERT INTO campaigns (id, title, description, media_type, media_url, fallback_url,
        duration_seconds, is_active, allow_early_skip, created_at, updated_at)
       VALUES (@id, @title, @description, @mediaType, @mediaUrl, @fallbackUrl,
        @durationSeconds, @isActive, @allowEarlySkip, @createdAt, @updatedAt)`
    ).run({
      id,
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : null,
      mediaType: body.mediaType,
      mediaUrl: body.mediaUrl.trim(),
      fallbackUrl: body.fallbackUrl ? String(body.fallbackUrl).trim() : null,
      durationSeconds: body.durationSeconds,
      isActive: body.isActive === false ? 0 : 1,
      allowEarlySkip: body.allowEarlySkip ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });

    const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    res.status(201).json(withQrText(rowToCampaign(created)));
  });

  router.put('/:id', requireAdmin, (req, res) => {
    const id = req.params.id.toUpperCase();
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Campagne introuvable.' });

    const merged = {
      ...rowToCampaign(existing),
      ...sanitizePatch(req.body ?? {}),
      id,
    };
    const built = buildPayload(merged);
    if (!built.ok) return res.status(422).json({ errors: built.errors });

    db.prepare(
      `UPDATE campaigns SET title=@title, description=@description, media_type=@mediaType,
        media_url=@mediaUrl, fallback_url=@fallbackUrl, duration_seconds=@durationSeconds,
        is_active=@isActive, allow_early_skip=@allowEarlySkip, updated_at=@updatedAt WHERE id=@id`
    ).run({ ...merged, isActive: merged.isActive ? 1 : 0, allowEarlySkip: merged.allowEarlySkip ? 1 : 0, updatedAt: new Date().toISOString() });

    const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    res.json(withQrText(rowToCampaign(updated)));
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const id = req.params.id.toUpperCase();
    const info = db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Campagne introuvable.' });
    res.json({ deleted: id });
  });

  return router;
}

function sanitizePatch(body) {
  const allowed = ['title', 'description', 'mediaType', 'mediaUrl', 'fallbackUrl', 'durationSeconds', 'isActive', 'allowEarlySkip'];
  const out = {};
  for (const key of allowed) if (key in body) out[key] = body[key];
  return out;
}
