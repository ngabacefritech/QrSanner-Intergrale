/**
 * Tests d'intégration de l'API : serveur réel, base SQLite temporaire,
 * port éphémère. Couvre l'authentification, le CRUD, le QR embarqué,
 * la déclaration de scan et les agrégats vus par le dashboard et le mobile.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const TOKEN = 'jeton-de-test';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrscanner-test-'));
process.env.DATABASE_PATH = path.join(dataDir, 'test.db');
process.env.ADMIN_TOKEN = TOKEN;

const { createApp } = await import('../src/index.js');
const { parsePayload } = await import('../src/payload.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function call(method, url, { body, token, raw } = {}) {
  const headers = {};
  if (token) headers['X-Api-Key'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (raw) return { status: response.status, text, headers: response.headers };
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

const campaign = {
  title: 'Offre de nuit',
  description: 'Remise immédiate',
  mediaType: 'video',
  mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
  durationSeconds: 15,
  allowEarlySkip: true,
};

test('/health répond sans jeton', async () => {
  const { status, json } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.campaignsInDb, 0);
});

test('les routes admin exigent le jeton', async () => {
  for (const [method, url] of [
    ['GET', '/api/admin/campaigns'],
    ['GET', '/api/admin/stats?days=7'],
    ['DELETE', '/api/admin/campaigns/ABCD1234'],
  ]) {
    const unauthorized = await call(method, url);
    assert.equal(unauthorized.status, 401, `${method} ${url} aurait dû refuser`);
    assert.equal(typeof unauthorized.json.error, 'string');
    const wrongToken = await call(method, url, { token: 'mauvais-jeton' });
    assert.equal(wrongToken.status, 401);
  }
  // La liste publique, elle, reste accessible (c'est ce que fait le mobile).
  assert.equal((await call('GET', '/api/campaigns')).status, 200);
});

test('création : 422 avec la liste des règles non respectées', async () => {
  const { status, json } = await call('POST', '/api/admin/campaigns', {
    token: TOKEN,
    body: { title: 'x', mediaType: 'pdf', mediaUrl: 'http://evil.org/a.mp4', durationSeconds: 900 },
  });
  assert.equal(status, 422);
  assert.ok(Array.isArray(json.errors));
  assert.ok(json.errors.length >= 4, json.errors.join(' | '));
  assert.ok(json.errors.some((e) => /mediaUrl/.test(e)));
});

let createdId;

test('création : 201 + QR embarqué relisible par le mobile', async () => {
  const { status, json } = await call('POST', '/api/admin/campaigns', { token: TOKEN, body: campaign });
  assert.equal(status, 201);
  createdId = json.id;
  assert.match(createdId, /^[A-Z0-9][A-Z0-9_-]{3,20}$/);
  assert.equal(json.isActive, true);

  const parsed = parsePayload(json.qrText);
  assert.deepEqual(parsed, {
    id: createdId,
    title: 'Offre de nuit',
    mediaType: 'video',
    mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
    durationSeconds: 15,
    description: 'Remise immédiate',
    fallbackUrl: null,
    allowEarlySkip: true,
  });

  // Identifiant explicite : accepté, mais unique.
  const withId = await call('POST', '/api/admin/campaigns', { token: TOKEN, body: { ...campaign, id: 'TESTID01' } });
  assert.equal(withId.status, 201);
  const duplicate = await call('POST', '/api/admin/campaigns', { token: TOKEN, body: { ...campaign, id: 'TESTID01' } });
  assert.equal(duplicate.status, 409);
  assert.equal((await call('DELETE', `/api/admin/campaigns/TESTID01`, { token: TOKEN })).status, 200);
});

test('liste publique : campagnes actives uniquement', async () => {
  const publicList = await call('GET', '/api/campaigns');
  assert.equal(publicList.status, 200);
  assert.deepEqual(publicList.json.campaigns.map((c) => c.id), [createdId]);

  // Désactivation → la campagne disparaît du flux mobile mais reste visible de l'admin.
  const off = await call('PUT', `/api/admin/campaigns/${createdId}`, { token: TOKEN, body: { isActive: false } });
  assert.equal(off.status, 200);
  assert.equal(off.json.isActive, false);
  assert.deepEqual((await call('GET', '/api/campaigns')).json.campaigns, []);
  assert.equal((await call('GET', '/api/admin/campaigns', { token: TOKEN })).json.campaigns.length, 1);

  // Réactivation.
  assert.equal((await call('PUT', `/api/admin/campaigns/${createdId}`, { token: TOKEN, body: { isActive: true } })).status, 200);
});

test('déclaration de scan : 201, contrôles et stats', async () => {
  const ok = await call('POST', '/api/admin/scans', {
    body: { campaignId: createdId, platform: 'ios', appVersion: '1.0.0', source: 'embedded', scannedAt: new Date().toISOString() },
  });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.json, { recorded: true });

  // Source inconnue normalisée, plateforme filtrée, pas de jeton requis.
  assert.equal((await call('POST', '/api/admin/scans', { body: { campaignId: createdId, source: 'n importe', platform: 'windows' } })).status, 201);
  assert.equal((await call('POST', '/api/admin/scans', { body: { campaignId: 'INCONNU99' } })).status, 404);
  assert.equal((await call('POST', '/api/admin/scans', { body: { campaignId: 'mauvais format !' } })).status, 422);
  assert.equal(
    (await call('POST', '/api/admin/campaigns', { token: TOKEN, body: { ...campaign, id: 'INACTIF01', isActive: false } })).status,
    201
  );
  assert.equal((await call('POST', '/api/admin/scans', { body: { campaignId: 'INACTIF01' } })).status, 422);
});

test('statistiques : agrégats attendus par le dashboard', async () => {
  const { status, json } = await call('GET', '/api/admin/stats?days=7', { token: TOKEN });
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(json).sort(), ['byPlatform', 'bySource', 'daily', 'perCampaign', 'totals']);
  assert.equal(json.totals.scans, 2);
  assert.equal(json.totals.scansToday, 2);
  assert.equal(json.totals.campaignsActive, 1);
  assert.equal(json.daily.length, 7); // série continue, jours à 0 inclus
  assert.ok(json.daily.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day)));
  assert.equal(json.daily.at(-1).scans, 2); // aujourd'hui
  assert.equal(json.daily.slice(0, -1).every((d) => d.scans === 0), true);
  assert.deepEqual(json.bySource.map((s) => s.source).sort(), ['embedded', 'unknown']);
  const perCampaign = json.perCampaign.find((c) => c.id === createdId);
  assert.equal(perCampaign.scans, 2);
  assert.equal(perCampaign.isActive, true);

  // Historique par campagne (admin).
  const history = await call('GET', `/api/admin/scans/${createdId}?limit=10`, { token: TOKEN });
  assert.equal(history.status, 200);
  assert.equal(history.json.total, 2);
  assert.equal(history.json.scans.length, 2);

  // Bornes du paramètre `days`.
  assert.equal((await call('GET', '/api/admin/stats?days=abc', { token: TOKEN })).status, 200);
  assert.equal((await call('GET', '/api/admin/stats?days=99999', { token: TOKEN })).json.daily.length, 90);
});

test('export CSV téléchargeable', async () => {
  const { status, text, headers } = await call('GET', '/api/admin/stats/export.csv', { token: TOKEN, raw: true });
  assert.equal(status, 200);
  assert.match(headers.get('content-type'), /text\/csv/);
  const lines = text.trim().split('\n');
  assert.equal(lines[0], 'campaign_id,scanned_at,platform,app_version,source');
  assert.equal(lines.length, 3); // en-tête + 2 scans déclarés au test précédent
  assert.ok(lines.slice(1).every((l) => l.startsWith(createdId + ',')));
  assert.equal((await call('GET', '/api/admin/stats/export.csv')).status, 401);
});

test('suppression : 200 puis 404 sur les routes dépendantes', async () => {
  assert.equal((await call('DELETE', `/api/admin/campaigns/INACTIF01`, { token: TOKEN })).status, 200);
  assert.equal((await call('DELETE', `/api/admin/campaigns/INACTIF01`, { token: TOKEN })).status, 404);
  assert.equal((await call('GET', '/api/admin/scans/INACTIF01', { token: TOKEN })).json.total, 0);
  assert.equal((await call('PUT', '/api/admin/campaigns/ABSENT01', { token: TOKEN, body: { title: 'Rien' } })).status, 404);
});

test('corps trop volumineux et JSON cassé sont refusés proprement', async () => {
  const huge = await call('POST', '/api/admin/campaigns', { token: TOKEN, body: { ...campaign, description: 'x'.repeat(200_000) } });
  assert.equal(huge.status, 413);
  const broken = await fetch(`${base}/api/campaigns`, { method: 'POST', body: '{' });
  assert.equal(broken.status, 404); // POST non supporté sur la liste publique
});
