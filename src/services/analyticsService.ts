/**
 * Déclaration d'un scan à l'API de la console (statistiques).
 *
 * Règles :
 *  - aucune requête si la synchronisation n'est pas activée explicitement ;
 *  - la requête ne contient AUCUNE donnée personnelle : identifiant de campagne,
 *  plateforme, version de l'app, mode de résolution. Pas de position, pas
 *  d'identifiant d'appareil, pas d'image ;
 *  - best effort : un échec réseau est silencieux (le scan reste réussi),
 *    et l'événement n'est pas mis en file d'attente — c'est un compteur, pas un reçu.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiConfig } from './apiConfig';

export type ScanSource = 'registry' | 'embedded' | 'direct-url';

export interface ScanEventPayload {
  readonly campaignId: string;
  readonly source: ScanSource;
  readonly scannedAt: string;
  readonly platform: string;
  readonly appVersion: string;
}

const ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{3,20}$/;

/** Construit la charge utile (fonction pure, testable). */
export function buildScanPayload(
  campaignId: string,
  source: ScanSource,
  now: Date = new Date(),
  platform: string = Platform.OS,
  appVersion: string = Constants.expoConfig?.version ?? '0.0.0'
): ScanEventPayload | null {
  const id = String(campaignId ?? '').trim().toUpperCase();
  if (!ID_PATTERN.test(id)) return null;
  return {
    campaignId: id,
    source,
    scannedAt: now.toISOString(),
    platform: platform === 'ios' || platform === 'android' ? platform : 'other',
    appVersion,
  };
}

/** Envoie si (et seulement si) la sync est activée ; ne lève jamais. */
export async function reportScan(campaignId: string, source: ScanSource): Promise<{ sent: boolean; reason?: string }> {
  const config = await getApiConfig();
  if (!config.enabled || config.baseUrl.length === 0) return { sent: false, reason: 'Synchronisation désactivée.' };
  const payload = buildScanPayload(campaignId, source);
  if (!payload) return { sent: false, reason: 'Identifiant de campagne non conforme.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${config.baseUrl}/api/admin/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return { sent: false, reason: `Le serveur a répondu ${response.status}.` };
    return { sent: true };
  } catch {
    return { sent: false, reason: 'Serveur injoignable : statistiques non comptées.' };
  } finally {
    clearTimeout(timer);
  }
}
