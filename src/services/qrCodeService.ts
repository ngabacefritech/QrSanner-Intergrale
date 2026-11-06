/**
 * Service de résolution des QR codes.
 *
 * Règles de sécurité :
 * - le contenu du QR est traité comme une donnée NON fiable, jamais exécutée ;
 * - aucune navigation externe n'est déclenchée (pas de Linking.openURL, pas de WebView) ;
 * - les URLs distantes ne sont acceptées qu'après validation HTTPS stricte ;
 * - une URL inconnue n'est JAMAIS affichée : seule une campagne du registre l'est
 *   (ou une URL déjà répertoriée dans une campagne de démonstration qui l'autorise).
 */
import { campaignService, type CampaignService } from './campaignService';
import { looksLikeEmbeddedJson, parseEmbeddedQr, type EmbeddedCampaign } from './embeddedQr';
import type { CampaignRecord, QrResolutionErrorCode, QrResolutionResult, ResolvedAd } from '../types/campaign';
import {
  extractCampaignIdFromUrl,
  looksLikeFreeText,
  MAX_QR_LENGTH,
  isValidDurationSeconds,
  isValidQrText,
  looksLikeUrl,
  normalizeCampaignId,
  validateMediaUrl,
} from '../utils/validation';

/** Cooldown anti-re-scan du même code, en millisecondes. */
export const RESCAN_COOLDOWN_MS = 2500;

/** Messages compréhensibles, en français, pour chaque code d'erreur. */
export const QR_ERROR_MESSAGES: Readonly<Record<QrResolutionErrorCode, string>> = {
  EMPTY_INPUT: 'QR code vide : rien n’a été détecté.',
  TOO_LONG: 'QR code trop long : contenu refusé.',
  UNSUPPORTED_CONTENT: 'Contenu non pris en charge : seuls les QR codes de campagne sont acceptés.',
  UNKNOWN_CAMPAIGN: 'QR code inconnu : aucune campagne active associée.',
  INACTIVE_CAMPAIGN: 'Publicité désactivée : cette campagne n’est plus diffusée.',
  INVALID_DURATION: 'Durée de publicité invalide : scan refusé.',
  UNSAFE_URL: 'Lien refusé : seuls les médias HTTPS valides sont autorisés.',
  EMBEDDED_INVALID: 'Campagne illisible : le contenu du QR ne respecte pas le format attendu.',
};

function fail(code: QrResolutionErrorCode): QrResolutionResult {
  return { ok: false, code, message: QR_ERROR_MESSAGES[code] };
}

/** Construit une publicité à partir d'un QR autonome (JSON embarqué validé). */
export function buildAdFromEmbedded(campaign: EmbeddedCampaign): ResolvedAd {
  return {
    campaignId: campaign.id,
    title: campaign.title,
    mediaType: campaign.mediaType,
    mediaSource: { kind: 'remote', url: campaign.mediaUrl },
    durationSeconds: campaign.durationSeconds,
    description: campaign.description ?? undefined,
    fallbackImage: campaign.fallbackUrl ? { kind: 'remote', url: campaign.fallbackUrl } : undefined,
    allowEarlySkip: campaign.allowEarlySkip === true,
  };
}

/** Construit une publicité normalisée à partir d'un enregistrement du registre. */
export function buildAd(record: CampaignRecord): ResolvedAd | null {
  if (!isValidDurationSeconds(record.durationSeconds)) return null;
  return {
    campaignId: record.id,
    title: record.title,
    mediaType: record.mediaType,
    mediaSource: record.mediaSource,
    durationSeconds: record.durationSeconds,
    description: record.description,
    fallbackImage: record.fallbackImage,
    allowEarlySkip: record.allowEarlySkip === true,
  };
}

/**
 * Valide une URL candidat (issue d'un QR « type A ») contre la liste blanche
 * construite à partir des campagnes de démonstration qui l'autorisent.
 */
async function resolveDirectUrlMedia(
  input: string,
  service: CampaignService
): Promise<{ readonly ad: ResolvedAd; readonly error?: undefined } | { readonly ad: null; readonly error: QrResolutionErrorCode }> {
  const validation = validateMediaUrl(input);
  if (!validation.ok) return { ad: null, error: 'UNSAFE_URL' };

  const campaigns = await service.listCampaigns();
  const match = campaigns.find(
    (campaign) =>
      campaign.isActive &&
      campaign.allowDirectUrlMedia &&
      campaign.mediaSource.kind === 'remote' &&
      validateMediaUrl(campaign.mediaSource.url).ok &&
      new URL(campaign.mediaSource.url).href === validation.url
  );
  if (!match) return { ad: null, error: 'UNKNOWN_CAMPAIGN' };

  const ad = buildAd(match);
  if (!ad) return { ad: null, error: 'INVALID_DURATION' };
  return { ad };
}

/**
 * Point d'entrée unique : contenu brut du QR code → publicité normalisée ou erreur typée.
 */
export async function resolveQrCode(
  qrData: unknown,
  service: CampaignService = campaignService
): Promise<QrResolutionResult> {
  if (typeof qrData !== 'string') return fail('EMPTY_INPUT');
  const input = qrData.trim();
  if (input.length === 0) return fail('EMPTY_INPUT');
  const inputLength = input.length;
  if (!isValidQrText(input)) return fail(inputLength > MAX_QR_LENGTH ? 'TOO_LONG' : 'UNSUPPORTED_CONTENT');

  // A0) QR « autonome » émis par la console : la publicité est dans le QR.
  //     Politique :
  //      - sync active et serveur joignable → le registre fait foi (permet de
  //        retirer ou désactiver une campagne sans réimprimer) ;
  //      - sync désactivée ou serveur injoignable → on fait confiance au contenu
  //        du QR, déjà validé strictement (schéma, URLs HTTPS, bornes de durée).
  if (looksLikeEmbeddedJson(input)) {
    const parsed = parseEmbeddedQr(input);
    if (parsed.status === 'invalid') return fail('EMBEDDED_INVALID');
    if (parsed.status === 'ok') {
      if (service.kind === 'remote' && !service.degraded) {
        const authoritative = await service.findById(parsed.campaign.id);
        if (!authoritative) return fail('UNKNOWN_CAMPAIGN');
        if (!authoritative.isActive) return fail('INACTIVE_CAMPAIGN');
        const fromRegistry = buildAd(authoritative);
        return fromRegistry ? { ok: true, ad: fromRegistry, source: 'registry' } : fail('INVALID_DURATION');
      }
      return { ok: true, ad: buildAdFromEmbedded(parsed.campaign), source: 'embedded' };
    }
  }

  // Texte libre (ni URL, ni identifiant, ni JSON de campagne) : refus explicite.
  if (looksLikeFreeText(input)) return fail('UNSUPPORTED_CONTENT');

  // A) Si le QR est une URL : un média déclaré par une campagne de démo qui
  //    autorise l'accès direct peut être affiché (URL re-validée HTTPS).
  if (looksLikeUrl(input)) {
    const direct = await resolveDirectUrlMedia(input, service);
    if (direct.ad) return { ok: true, ad: direct.ad, source: 'direct-url' };
  }

  // B) Valeur brute enregistrée dans le registre (QR « type B » par valeur exacte).
  const byValue = await service.findByQrCodeValue(input);
  if (byValue) {
    if (!byValue.isActive) return fail('INACTIVE_CAMPAIGN');
    const ad = buildAd(byValue);
    return ad ? { ok: true, ad, source: 'registry' } : fail('INVALID_DURATION');
  }

  // C) Identifiant explicite (DEMO-XXXX) ou encodé dans une URL de redirection connue.
  const candidateId = normalizeCampaignId(input) ?? extractCampaignIdFromUrl(input);
  if (candidateId === null && !looksLikeUrl(input) && !/^(?:qrscanner|qrsc):\/\//i.test(input)) {
    return fail('UNSUPPORTED_CONTENT');
  }
  if (candidateId) {
    const byId = await service.findById(candidateId);
    if (byId) {
      if (!byId.isActive) return fail('INACTIVE_CAMPAIGN');
      const ad = buildAd(byId);
      return ad ? { ok: true, ad, source: 'registry' } : fail('INVALID_DURATION');
    }
    // Si l'ID venait d'une URL distante, on précise le vrai motif de refus.
    if (looksLikeUrl(input) && !validateMediaUrl(input).ok) return fail('UNSAFE_URL');
  } else if (looksLikeUrl(input)) {
    // Contenu ressemblant à une URL mais jamais exécutable : le refus est explicite.
    return fail(validateMediaUrl(input).ok ? 'UNKNOWN_CAMPAIGN' : 'UNSAFE_URL');
  }

  return fail('UNKNOWN_CAMPAIGN');
}

/**
 * Garde anti double-scan, testable hors React : le même code ne peut pas être
 * resoumis pendant `cooldownMs`, et un scan n'est accepté que si aucun autre
 * n'est en cours (`inFlight`).
 */
export function canAcceptScan(args: {
  value: string;
  lastValue: string | null;
  lastAt: number | null;
  inFlight: boolean;
  now?: number;
  cooldownMs?: number;
}): boolean {
  const { value, lastValue, lastAt, inFlight, now = Date.now(), cooldownMs = RESCAN_COOLDOWN_MS } = args;
  if (inFlight) return false;
  if (lastValue !== null && value === lastValue && lastAt !== null && now - lastAt < cooldownMs) return false;
  return true;
}
