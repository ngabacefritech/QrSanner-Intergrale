/** Types de navigation — source de vérité pour les paramètres d'écrans. */

import type { MediaType } from '../types/campaign';

/** Publicité embarquée dans le QR : transitre telle quelle vers l'écran d'affichage. */
export interface EmbeddedAdParam {
  campaignId: string;
  title: string;
  mediaType: MediaType;
  mediaUrl: string;
  durationSeconds: number;
  description: string | null;
  fallbackUrl: string | null;
  allowEarlySkip: boolean;
}

export type RootStackParamList = {
  Scanner: undefined;
  Advertisement: {
    /** Identifiant de campagne résolu (sert à recharger les données si besoin). */
    campaignId: string;
    /** Valeur brute du QR scanné (journalisation locale uniquement). */
    qrValue: string;
    /** Durée imposée par la campagne, déjà clampée côté service. */
    durationSeconds: number;
    /** Horodatage ISO de la résolution du scan. */
    resolvedAt: string;
    /** 'embedded' : la publicité vient du QR ; 'registry' : du registre (local ou API). */
    origin: 'registry' | 'embedded';
    /** Données déjà validées, fournies quand le registre n'est pas nécessaire. */
    embedded?: EmbeddedAdParam;
  };
  About: undefined;
  Settings: undefined;
};
