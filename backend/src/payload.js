export const APP_TAG = 'qrscanner';

export function generateCampaignId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';

  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return out;
}

export function buildPayload(input) {
  const errors = [];

  const id = String(input.id ?? '').trim().toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9_-]{3,20}$/.test(id)) {
    errors.push('Identifiant de campagne invalide.');
  }

  const title = String(input.title ?? '').trim();

  if (title.length < 2 || title.length > 60) {
    errors.push('Le titre doit contenir entre 2 et 60 caractères.');
  }

  const mediaUrl = String(input.mediaUrl ?? '').trim();

  if (!isValidMediaUrl(mediaUrl)) {
    errors.push('URL vidéo invalide.');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const playerBaseUrl = (
    process.env.PLAYER_BASE_URL || 'http://localhost:5173'
  ).replace(/\/+$/, '');

  const qrText = `${playerBaseUrl}/play/${encodeURIComponent(id)}`;

  return {
    ok: true,
    qrText,
    bytes: Buffer.byteLength(qrText, 'utf8'),
    payload: { id, title, mediaUrl }
  };
}

export function isValidMediaUrl(value) {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value.trim());

    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}