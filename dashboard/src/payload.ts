/**
 * Règles du QR « JSON embarqué », identiques au backend (src/payload.js).
 * Le dashboard les applique pour un retour immédiat ; le backend re-valide,
 * sa réponse fait foi en cas de divergence.
 */
import type { CampaignDraft } from './types';

export const APP_TAG = 'qrscanner';
export const PAYLOAD_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 1600;

const ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{3,20}$/;

export function isValidMediaUrl(value: string): boolean {
  if (/\s/.test(value) || value.length === 0 || value.length > 400) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return false;
  if (u.username || u.password) return false;
  if (u.port && !local && u.port !== '443') return false;
  if (!local && !host.includes('.')) return false;
  return true;
}

export interface PayloadResult {
  ok: boolean;
  errors: string[];
  qrText?: string;
  bytes?: number;
}

export function buildQrText(draft: CampaignDraft, id: string): PayloadResult {
  const errors: string[] = [];
  const upper = id.trim().toUpperCase();
  if (!ID_PATTERN.test(upper)) errors.push("id : 4 à 21 caractères [A-Z0-9_-], commençant par une lettre ou un chiffre");
  if (draft.title.trim().length < 2 || draft.title.trim().length > 60) errors.push('titre : entre 2 et 60 caractères');
  if (draft.mediaType !== 'image' && draft.mediaType !== 'video') errors.push("média : 'image' ou 'video'");
  const mediaUrl = draft.mediaUrl.trim();
  if (!isValidMediaUrl(mediaUrl)) errors.push('URL du média : HTTPS requis (http autorisé en localhost), sans identifiants ni port inhabituel');
  const fallbackUrl = draft.fallbackUrl.trim() || null;
  if (fallbackUrl && !isValidMediaUrl(fallbackUrl)) errors.push('URL de repli : mêmes règles que l’URL du média');
  const d = Number(draft.durationSeconds);
  if (!Number.isInteger(d) || d < 1 || d > 300) errors.push('durée : entier entre 1 et 300 secondes');
  if (errors.length > 0) return { ok: false, errors };

  const description = draft.description.trim() ? draft.description.trim().slice(0, 140) : null;
  const payload: Record<string, unknown> = {
    app: APP_TAG,
    v: PAYLOAD_VERSION,
    id: upper,
    t: draft.title.trim(),
    m: draft.mediaType === 'video' ? 1 : 0,
    u: mediaUrl,
    d,
  };
  if (description) payload.s = description;
  if (fallbackUrl) payload.f = fallbackUrl;
  if (draft.allowEarlySkip) payload.k = 1;

  const qrText = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(qrText).length;
  if (bytes > MAX_PAYLOAD_BYTES) {
    return { ok: false, errors: [`contenu trop volumineux : ${bytes} octets (max ${MAX_PAYLOAD_BYTES}) — raccourcissez titre, description ou URL`] };
  }
  return { ok: true, errors: [], qrText, bytes };
}

export function generateId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
