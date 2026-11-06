/**
 * Choisit le registre de campagnes à interroger selon la configuration :
 *  - sync désactivée (défaut) → registre local embarqué ;
 *  - sync activée → registre distant (API de la console).
 * L'instance distante est mémoïsée pour conserver son cache et son état
 * « degraded » entre deux scans.
 */
import { getApiConfig } from './apiConfig';
import {
  campaignService,
  LocalCampaignService,
  RemoteCampaignService,
  type CampaignService,
} from './campaignService';

let remoteService: RemoteCampaignService | null = null;
let remoteBaseUrl: string | null = null;

export async function getCampaignService(): Promise<CampaignService> {
  const config = await getApiConfig();
  if (!config.enabled || config.baseUrl.length === 0) return campaignService;
  if (!remoteService || remoteBaseUrl !== config.baseUrl) {
    try {
      remoteService = new RemoteCampaignService(config.baseUrl);
      remoteBaseUrl = config.baseUrl;
    } catch {
      // URL refusée par la politique de sécurité : on retombe sur le local.
      return campaignService;
    }
  }
  return remoteService;
}

/** Réinitialise l'instance distante (après modification de la configuration). */
export function resetRegistryProvider(): void {
  remoteService = null;
  remoteBaseUrl = null;
}
