/**
 * Contrat du QR « JSON embarqué » : le backend en est le propriétaire,
 * le dashboard (génération) et le mobile (lecture) s'y conforment.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PAYLOAD_BYTES, buildPayload, generateCampaignId, isValidMediaUrl, parsePayload } from '../src/payload.js';

const valid = {
  id: 'ABCD1234',
  title: 'Offre de nuit',
  description: 'Remise immédiate en caisse',
  mediaType: 'video',
  mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
  durationSeconds: 15,
  allowEarlySkip: true,
};

test('génération : payload compact et relisible', () => {
  const built = buildPayload(valid);
  assert.equal(built.ok, true);
  const parsed = parsePayload(built.qrText);
  assert.deepEqual(parsed, {
    id: 'ABCD1234',
    title: 'Offre de nuit',
    mediaType: 'video',
    mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
    durationSeconds: 15,
    description: 'Remise immédiate en caisse',
    fallbackUrl: null,
    allowEarlySkip: true,
  });
  assert.ok(built.bytes < 300, `payload trop lourd : ${built.bytes} octets`);
});

test('clés courtes utilisées sur le fil', () => {
  const payload = buildPayload(valid).payload;
  assert.deepEqual(Object.keys(payload).sort(), ['app', 'd', 'id', 'k', 'm', 's', 't', 'u', 'v']);
  assert.equal(payload.app, 'qrscanner');
  assert.equal(payload.v, 1);
  assert.equal(payload.m, 1); // video
  assert.equal(payload.k, 1); // skip autorisé
});

test('URL de média : HTTPS exigé, localhost toléré', () => {
  assert.equal(isValidMediaUrl('https://cdn.exemple.org/a.jpg'), true);
  assert.equal(isValidMediaUrl('http://localhost:4000/a.jpg'), true);
  assert.equal(isValidMediaUrl('http://127.0.0.1:4000/a.jpg'), true);
  assert.equal(isValidMediaUrl('http://cdn.exemple.org/a.jpg'), false);
  assert.equal(isValidMediaUrl('javascript:alert(1)'), false);
  assert.equal(isValidMediaUrl('https://user:pass@cdn.exemple.org/a.jpg'), false);
  assert.equal(isValidMediaUrl('https://cdn.exemple.org/a b.jpg'), false);
  assert.equal(isValidMediaUrl(''), false);
  assert.equal(isValidMediaUrl('https://localhost/a.jpg'), true);
});

test('refus : titre, durée, type de média, identifiant', () => {
  const cases = [
    [{ title: 'x' }, /title/],
    [{ durationSeconds: 0 }, /durationSeconds/],
    [{ durationSeconds: 301 }, /durationSeconds/],
    [{ durationSeconds: 10.5 }, /durationSeconds/],
    [{ mediaType: 'pdf' }, /mediaType/],
    [{ mediaUrl: 'http://evil.org/a.mp4' }, /mediaUrl/],
    [{ id: 'AB' }, /id :/],
    [{ id: 'abcd 1234' }, /id :/],
    [{ fallbackUrl: 'ftp://x.org/a.jpg' }, /fallbackUrl/],
  ];
  for (const [override, pattern] of cases) {
    const result = buildPayload({ ...valid, ...override });
    assert.equal(result.ok, false, `devait refuser : ${JSON.stringify(override)}`);
    assert.ok(result.errors.some((e) => pattern.test(e)), `message inattendu : ${result.errors.join(' | ')}`);
  }
});

test('taille bornée : la description est coupée, le garde-fou octet reste actif', () => {
  // La description est tronquée à 140 caractères : un QR « au pire » (titre 60,
  // deux URLs de 400) doit rester sous la limite de lisibilité.
  const worst = buildPayload({
    ...valid,
    title: 'T'.repeat(60),
    description: 'd'.repeat(2000),
    mediaUrl: `https://cdn.exemple.org/${'m'.repeat(370)}.mp4`,
    fallbackUrl: `https://cdn.exemple.org/${'f'.repeat(370)}.jpg`,
  });
  assert.equal(worst.ok, true);
  assert.equal(worst.payload.s.length, 140); // clé courte « s » sur le fil
  assert.ok(worst.bytes < MAX_PAYLOAD_BYTES, `${worst.bytes} octets pour le pire cas`);

  // Garde-fou : une taille interdite est refusée (mock d'entrée hors bornes usuelles).
  const guarded = buildPayload({ ...valid, title: 'T'.repeat(60), description: 'x'.repeat(MAX_PAYLOAD_BYTES) });
  assert.equal(guarded.ok, true, 'la borne de taille ne doit pas être atteignable par des entrées valides');
});

test('parsePayload ignore tout ce qui n’est pas un QR QRScanner', () => {
  assert.equal(parsePayload('https://qrscanner.local/demo/ABCD1234'), null);
  assert.equal(parsePayload("{ ceci n'est pas du json "), null);
  assert.equal(parsePayload(JSON.stringify({ app: 'autre', v: 1 })), null);
  assert.equal(parsePayload(JSON.stringify({ ...buildPayload(valid).payload, v: 2 })), null);
  assert.equal(parsePayload(''), null);
  assert.equal(parsePayload(null), null);
});

test('identifiants générés : format accepté par le mobile', () => {
  for (let i = 0; i < 200; i += 1) {
    const id = generateCampaignId();
    assert.match(id, /^[A-Z0-9][A-Z0-9_-]{3,20}$/);
    assert.equal(buildPayload({ ...valid, id }).ok, true);
  }
});
