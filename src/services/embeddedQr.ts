/**
 * Validation/normalisation du contenu d'un QR « JSON embarqué » produit par la
 * console QRScanner (dashboard). Le contenu reste une DONNÉE non fiable :
 * aucune exécution, aucun ouverture de lien, URLs re-validées.
 *
 * Prototype partagé avec backend/src/payload.js et dashboard/src/payload.ts.
 */
import { normalizeCampaignId, validateMediaUrl } from '../utils/validation';

export const EMBEDDED_APP_TAG = 'qrscanner';
export const EMBEDDED_VERSION = 1;

export interface EmbeddedCampaign {
  readonly id: string;
  readonly title: string;
  readonly mediaType: 'image' | 'video';
  readonly mediaUrl: string;
  readonly durationSeconds: number;
  readonly description: string | null;
  readonly fallbackUrl: string | null;
  readonly allowEarlySkip: boolean;
}

const MAX_JSON_BYTES = 4096;

/** Longueur en octets UTF-8 (sans dépendre de TextEncoder, absent de certains runtimes). */
function utf8Length(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4; // paire de substitution
      i += 1;
    } else n += 3;
  }
  return n;
}

function isSecureMediaUrl(value: string): boolean {
  return validateMediaUrl(value).ok;
}

/** Reconnaît une forme JSON (sans la parser) : évite un JSON.parse sur tout et n'importe quoi. */
export function looksLikeEmbeddedJson(value: string): boolean {
  const t = value.trim();
  return t.length > 1 && t.startsWith('{') && t.endsWith('}');
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (t.length === 0 || t.length > max) return null;
  // aucun caractère de contrôle dans les textes affichés
  if (/[\u0000-\u001F\u007F]/.test(t)) return null;
  return t;
}

/**
 * @returns la campagne normalisée, `null` si le texte n'est pas un QR QRScanner,
 *          ou `{ ok: false, reason }` si le format est reconnu mais invalide.
 */
export function parseEmbeddedQr(
  raw: string
): { status: 'not-embedded' } | { status: 'invalid'; reason: string } | { status: 'ok'; campaign: EmbeddedCampaign } {
  const text = raw.trim();
  if (!looksLikeEmbeddedJson(text)) return { status: 'not-embedded' };
  if (utf8Length(text) > MAX_JSON_BYTES) return { status: 'invalid', reason: 'CONTENU_TROP_LONG' };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // JSON ressemblant mais cassé : ce n'est pas un QR QRScanner exploitable.
    return { status: 'invalid', reason: 'JSON_INVALIDE' };
  }
  if (typeof data !== 'object' || data === null) return { status: 'not-embedded' };

  const obj = data as Record<string, unknown>;
  if (obj.app !== EMBEDDED_APP_TAG) return { status: 'not-embedded' };
  if (obj.v !== EMBEDDED_VERSION) {
    return { status: 'invalid', reason: `VERSION_INCOMPATIBLE (${String(obj.v)})` };
  }

  const id = normalizeCampaignId(obj.id);
  if (!id) return { status: 'invalid', reason: 'IDENTIFIANT_INVALIDE' };

  const title = asText(obj.t, 80);
  if (!title || title.length < 2) return { status: 'invalid', reason: 'TITRE_INVALIDE' };

  if (obj.m !== 0 && obj.m !== 1) return { status: 'invalid', reason: 'TYPE_DE_MEDIA_INVALIDE' };
  const mediaType: 'image' | 'video' = obj.m === 1 ? 'video' : 'image';

  const mediaUrl = asText(obj.u, 400);
  if (!mediaUrl || !isSecureMediaUrl(mediaUrl)) return { status: 'invalid', reason: 'URL_MEDIA_NON_SECURISEE' };

  const duration = obj.d;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 300) {
    return { status: 'invalid', reason: 'DUREE_INVALIDE' };
  }

  let fallbackUrl: string | null = null;
  if (obj.f !== undefined && obj.f !== null) {
    const f = asText(obj.f, 400);
    if (!f || !isSecureMediaUrl(f)) return { status: 'invalid', reason: 'URL_DE_REPLI_NON_SECURISEE' };
    fallbackUrl = f;
  }

  const description = obj.s === undefined || obj.s === null ? null : asText(obj.s, 200);
  if (obj.s !== undefined && obj.s !== null && description === null) {
    return { status: 'invalid', reason: 'DESCRIPTION_INVALIDE' };
  }

  return {
    status: 'ok',
    campaign: {
      id,
      title,
      mediaType,
      mediaUrl,
      durationSeconds: duration,
      description,
      fallbackUrl,
      allowEarlySkip: obj.k === 1,
    },
  };
}
