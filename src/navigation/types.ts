/** Types de navigation — source de vérité pour les paramètres d'écrans. */

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
  };
  About: undefined;
};
