import type { UrlValidationResult } from '../types/campaign';

/** Longueur maximale acceptée pour le contenu d'un QR code (protection DoS simple). */
export const MAX_QR_LENGTH = 2048;
/** Format d'identifiant de campagne attendu (démo). */
const CAMPAIGN_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,63}$/i;

/** Le contenu est-il exploitable (non vide, borné, sans octets de contrôle) ? */
export function isValidQrText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_QR_LENGTH) return false;
  // Les QR codes « textes bruts » ne doivent jamais contenir de caractères de contrôle
  // ni de préfixes de plan de code qui, historiquement, déclenchent des actions système.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  if (/^(BEGIN:VCARD|MECARD:|WIFI:|BEGIN:BLUETOOTH)/i.test(trimmed)) return false;
  return true;
}

/** Normalise un identifiant candidat (trim, majuscules ; espaces internes refusés). */
export function normalizeCampaignId(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const id = candidate.trim().toUpperCase();
  if (/\s/.test(id)) return null;
  return CAMPAIGN_ID_PATTERN.test(id) ? id : null;
}

/** Vrai texte « libre » (prose, vCard…) : jamais une URL ni un identifiant. */
export function looksLikeFreeText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (looksLikeUrl(trimmed) || /^qrscanner:\/\//i.test(trimmed)) return false;
  if (normalizeCampaignId(trimmed) !== null) return false;
  // Espace interne ou caractères non ASCII typiques d'un texte libre.
  return /\s/.test(trimmed) || /[^\x00-\x7F]/.test(trimmed);
}

/** Le texte ressemble-t-il à une URL http(s) ? */
export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Extrait l'identifiant de campagne encodé dans une URL de redirection
 * acceptée par la démo :
 *   - qrscanner://campaign/<ID>            (schéma applicatif, JAMAIS ouvert)
 *   - https://qrscanner.local/demo/<ID>
 *   - https://qrscanner.local/campaign/<ID>
 */
export function extractCampaignIdFromUrl(value: string): string | null {
  const trimmed = value.trim();
  const appScheme = /^(?:qrsc|qrscanner):\/\/(?:campaign\/|ad\/)?([^/?#\s]+)$/i.exec(trimmed);
  if (appScheme) return normalizeCampaignId(decodeSegment(appScheme[1] ?? ''));

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (parsed.hostname.toLowerCase() !== 'qrscanner.local') return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const namespace = segments[0]?.toLowerCase();
  if (namespace !== 'demo' && namespace !== 'campaign' && namespace !== 'c') return null;
  return normalizeCampaignId(decodeSegment(segments[1] ?? ''));
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // % malformé : on garde la valeur brute, qui sera rejetée par le format d'ID.
    return segment;
  }
}

/**
 * Valide une URL distante de média.
 * Règles : uniquement http/https, sans identifiants, hostname valide,
 * HTTPS obligatoire (HTTP toléré seulement pour localhost/127.0.0.1 en développement),
 * port 80/443 ou aucun, jamais `javascript:`, `file:` ou autres schémas.
 */
export function validateMediaUrl(rawUrl: unknown): UrlValidationResult {
  if (typeof rawUrl !== 'string') return { ok: false, reason: 'INVALID' };
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_QR_LENGTH || /\s/.test(trimmed)) {
    return { ok: false, reason: 'INVALID' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'INVALID' };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') return { ok: false, reason: 'SCHEME' };

  if (parsed.username !== '' || parsed.password !== '') return { ok: false, reason: 'INVALID' };

  const host = parsed.hostname.toLowerCase();
  const isLocalDevHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (!isLocalDevHost && !host.includes('.')) return { ok: false, reason: 'HOST' };

  if (protocol === 'http:' && !isLocalDevHost) return { ok: false, reason: 'SCHEME' };

  const port = parsed.port;
  if (port !== '' && port !== '80' && port !== '443' && !isLocalDevHost) {
    return { ok: false, reason: 'INVALID' };
  }

  return { ok: true, url: parsed.href };
}

/** Durée d'affichage valide : entier (ou chiffre) entre 1 et 300 secondes inclus. */
export function isValidDurationSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 300;
}

/** Clampe une durée dans la plage autorisée, avec défaut de 10 s si invalide. */
export function clampDuration(value: unknown, fallbackSeconds = 10): number {
  const n = typeof value === 'number' ? Math.floor(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallbackSeconds;
  return Math.min(300, Math.max(1, n));
}
