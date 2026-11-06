/**
 * Types stricts du modèle de données des campagnes publicitaires.
 * Toutes les valeurs provenant d'un QR code sont considérées comme NON fiables
 * et doivent passer par `src/services/qrCodeService.ts` avant tout usage.
 */

/** Type de média affiché par une campagne. */
export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/**
 * Origine d'un média publicitaire.
 * - `asset` : fichier embarqué dans l'application (clé retournée par `require()`).
 *   La valeur est la clé numérique d'asset (iOS) ou le chemin résolu (Android web),
 *   traitée par Metro/`expo-asset`, jamais par un navigateur.
 * - `remote` : URL distante, validée HTTPS (ou localhost HTTP en développement)
 *   par `isAllowedMediaUrl` avant tout chargement.
 */
export type MediaSource =
  | { readonly kind: 'asset'; readonly assetKey: number | string }
  | { readonly kind: 'remote'; readonly url: string };

/** Enregistrement d'une campagne publicitaire tel que renvoyé par le registre. */
export interface CampaignRecord {
  /** Identifiant unique de la campagne. */
  readonly id: string;
  /** Titre affiché pendant la publicité. */
  readonly title: string;
  /** Valeur brute encodée dans le QR code de test de la campagne. */
  readonly qrCodeValue: string;
  /** Type de média : image ou vidéo. */
  readonly mediaType: MediaType;
  /** Média principal (image ou vidéo MP4). */
  readonly mediaSource: MediaSource;
  /** Durée d'affichage imposée, en secondes (doit être un entier > 0). */
  readonly durationSeconds: number;
  /** Une campagne inactive est refusée au scan. */
  readonly isActive: boolean;
  /** Date de création (chaîne ISO 8601). */
  readonly createdAt: string;
  /** Description facultative affichée dans l'écran « À propos » et en légende. */
  readonly description?: string;
  /**
   * Image de repli affichée si la vidéo principale ne peut pas être chargée.
   * Doit être un asset local pour rester disponible hors ligne.
   */
  readonly fallbackImage?: MediaSource;
  /**
   * Autorise ou non l'utilisateur à fermer la publicité avant la fin
   * du compte à rebours (bouton « Passer »).
   */
  readonly allowEarlySkip: boolean;
  /**
   * Si `true`, une URL valide non enregistrée dans le registre est acceptée
   * directement comme média de démonstration (mode « le QR contient l'URL de la pub »).
   * Réservé aux campagnes de démonstration.
   */
  readonly allowDirectUrlMedia: boolean;
}

/** Publicité normalisée, prête à être affichée par l'écran Advertisement. */
export interface ResolvedAd {
  readonly campaignId: string;
  readonly title: string;
  readonly mediaType: MediaType;
  readonly mediaSource: MediaSource;
  readonly durationSeconds: number;
  readonly description?: string;
  readonly fallbackImage?: MediaSource;
  readonly allowEarlySkip: boolean;
}

/** Codes d'erreur renvoyés par la résolution d'un QR code. */
export type QrResolutionErrorCode =
  | 'EMPTY_INPUT'
  | 'TOO_LONG'
  | 'UNSUPPORTED_CONTENT'
  | 'UNKNOWN_CAMPAIGN'
  | 'INACTIVE_CAMPAIGN'
  | 'INVALID_DURATION'
  | 'UNSAFE_URL'
  | 'EMBEDDED_INVALID';

/** Provenance de la publicité affichée. */
export type AdOrigin = 'registry' | 'embedded';

/** Résultat typé de `resolveQrCode` : succès discrimé ou erreur typée. */
export type QrResolutionResult =
  | {
      readonly ok: true;
      readonly ad: ResolvedAd;
      /** `embedded` : publicité lue directement depuis le QR (hors ligne). */
      readonly source: 'registry' | 'direct-url' | 'embedded';
    }
  | { readonly ok: false; readonly code: QrResolutionErrorCode; readonly message: string };

/** Résultat de validation normalisée d'une URL distante. */
export type UrlValidationResult = { ok: true; url: string } | { ok: false; reason: 'INVALID' | 'SCHEME' | 'HOST' };
