/**
 * Service d'accès au registre des campagnes.
 *
 * La V1 utilise un registre local (`src/constants/campaigns.ts`).
 * Pour brancher un backend plus tard : implémenter `CampaignService` (voir
 * `RemoteCampaignService` ci-dessous), puis changer la valeur retournée par
 * `createCampaignService()` — aucun écran n'a besoin d'être modifié.
 */
import { DEMO_CAMPAIGNS } from '../constants/campaigns';
import type { CampaignRecord } from '../types/campaign';
import { normalizeCampaignId } from '../utils/validation';

export interface CampaignService {
  /** Liste toutes les campagnes (registre de démonstration). */
  listCampaigns(): Promise<CampaignRecord[]>;
  /** Recherche par identifiant (insensible à la casse, trim). */
  findById(campaignId: string): Promise<CampaignRecord | null>;
  /** Recherche par valeur exacte encodée dans le QR code. */
  findByQrCodeValue(qrValue: string): Promise<CampaignRecord | null>;
}

/** Normalise une valeur de QR pour la comparaison (trim, minuscules). */
function canonicalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Implémentation locale, asynchrone par contrat (comme une future API). */
export class LocalCampaignService implements CampaignService {
  constructor(private readonly campaigns: readonly CampaignRecord[] = DEMO_CAMPAIGNS) {}

  async listCampaigns(): Promise<CampaignRecord[]> {
    return [...this.campaigns];
  }

  async findById(campaignId: string): Promise<CampaignRecord | null> {
    const normalized = normalizeCampaignId(campaignId);
    if (!normalized) return null;
    return this.campaigns.find((campaign) => campaign.id.toUpperCase() === normalized) ?? null;
  }

  async findByQrCodeValue(qrValue: string): Promise<CampaignRecord | null> {
    const canonical = canonicalizeValue(qrValue);
    if (canonical.length === 0) return null;
    return this.campaigns.find((campaign) => canonicalizeValue(campaign.qrCodeValue) === canonical) ?? null;
  }
}

/**
 * Squelette d'implémentation distante — NON activé, NON testé : il n'existe
 * aucun serveur pour la V1 et aucune clé d'API ne doit être embarquée dans
 * le binaire mobile. Laisser `createCampaignService()` sur `LocalCampaignService`
 * tant que le backend n'existe pas.
 */
export class RemoteCampaignService implements CampaignService {
  constructor(
    /** Exemple : 'https://api.exemple.org' — configuration explicite obligatoire. */
    private readonly baseUrl: string
  ) {
    if (!/^https:\/\//i.test(baseUrl)) {
      throw new Error('RemoteCampaignService exige une base URL HTTPS.');
    }
  }

  async listCampaigns(): Promise<CampaignRecord[]> {
    const response = await fetch(`${this.baseUrl}/campaigns`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Registre distant indisponible (HTTP ${response.status}).`);
    return (await response.json()) as CampaignRecord[];
  }

  async findById(campaignId: string): Promise<CampaignRecord | null> {
    const all = await this.listCampaigns();
    const normalized = normalizeCampaignId(campaignId);
    return all.find((campaign) => campaign.id.toUpperCase() === normalized) ?? null;
  }

  async findByQrCodeValue(qrValue: string): Promise<CampaignRecord | null> {
    const all = await this.listCampaigns();
    return all.find((campaign) => canonicalizeValue(campaign.qrCodeValue) === canonicalizeValue(qrValue)) ?? null;
  }
}

/** Fabrique du service utilisé par toute l'application. */
export function createCampaignService(): CampaignService {
  // Étape « backend » : remplacer par `new RemoteCampaignService(API_URL)`.
  return new LocalCampaignService();
}

/** Instance partagée (pas de singleton réseau, simple objet en mémoire). */
export const campaignService: CampaignService = createCampaignService();
