/**
 * Service d'accès au registre des campagnes.
 *
 * Deux implémentations du même contrat :
 *  - `LocalCampaignService`   : registre embarqué de démonstration (défaut, hors ligne) ;
 *  - `RemoteCampaignService`  : API HTTP de la console (lecture publique GET /api/campaigns),
 *    activée uniquement si l'utilisateur l'a configurée dans l'écran « Connexion ».
 *
 * Politique de sécurité : HTTPS obligatoire, à l'exception des adresses de réseau
 * local (développement). Aucun secret n'est embarqué. Les échecs réseau ne
 * font jamais planter le scan : le service se déclare `degraded` et le résolution
 * retombe sur le QR autonome (JSON embarqué) ou le registre local.
 */
import { DEMO_CAMPAIGNS } from '../constants/campaigns';
import type { CampaignRecord } from '../types/campaign';
import { normalizeCampaignId } from '../utils/validation';

export interface CampaignService {
  /** `remote` = API distante ; `local` = registre embarqué. */
  readonly kind: 'local' | 'remote';
  /** true si la dernière interrogation distante a échoué (réseau/5xx). */
  readonly degraded: boolean;
  listCampaigns(): Promise<CampaignRecord[]>;
  findById(campaignId: string): Promise<CampaignRecord | null>;
  findByQrCodeValue(qrValue: string): Promise<CampaignRecord | null>;
}

function canonicalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Réponse du backend « liste des campagnes actives ». */
interface RemoteCampaignDto {
  id: string;
  title: string;
  description?: string | null;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  fallbackUrl?: string | null;
  durationSeconds: number;
  isActive?: boolean;
  allowEarlySkip?: boolean;
  createdAt?: string;
  qrText?: string | null;
}

function mapRemote(dto: RemoteCampaignDto): CampaignRecord {
  const mediaUrl = typeof dto.mediaUrl === 'string' ? dto.mediaUrl.trim() : '';
  const fallbackUrl = typeof dto.fallbackUrl === 'string' && dto.fallbackUrl.trim().length > 0 ? dto.fallbackUrl.trim() : null;
  return {
    id: String(dto.id).toUpperCase(),
    title: String(dto.title ?? 'Publicité').slice(0, 80),
    qrCodeValue: typeof dto.qrText === 'string' ? dto.qrText : `qrsc://${String(dto.id).toUpperCase()}`,
    mediaType: dto.mediaType === 'video' ? 'video' : 'image',
    mediaSource: { kind: 'remote', url: mediaUrl },
    durationSeconds: Number.isFinite(dto.durationSeconds) ? Math.trunc(dto.durationSeconds) : 10,
    isActive: dto.isActive !== false,
    createdAt: dto.createdAt ?? new Date(0).toISOString(),
    description: dto.description ?? undefined,
    fallbackImage: fallbackUrl ? { kind: 'remote', url: fallbackUrl } : undefined,
    allowEarlySkip: dto.allowEarlySkip === true,
    // Le média distant vient de NOTRE backend : la politique HTTPS est re-vérifiée
    // à l'affichage (utils/media.resolveMediaSource), pas ici.
    allowDirectUrlMedia: false,
  };
}

export class LocalCampaignService implements CampaignService {
  readonly kind = 'local' as const;
  readonly degraded = false;

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
 * Registre distant. Cache mémoire de courte durée (30 s) pour éviter de
 * harceler l'API pendant une session de scans, et repli silencieux sur le
 * dernier état connu en cas de panne réseau.
 */
export class RemoteCampaignService implements CampaignService {
  readonly kind = 'remote' as const;
  degraded = false;

  private cache: CampaignRecord[] | null = null;
  private cachedAt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly cacheTtlMs = 30_000,
    private readonly timeoutMs = 4000
  ) {
    if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.)/i.test(baseUrl)) {
      throw new Error('RemoteCampaignService exige HTTPS (ou une adresse locale en HTTP).');
    }
  }

  private async fetchCampaigns(force = false): Promise<CampaignRecord[]> {
    const fresh = this.cache !== null && Date.now() - this.cachedAt < this.cacheTtlMs;
    if (fresh && !force) return this.cache ?? [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/campaigns`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { campaigns?: RemoteCampaignDto[] };
      const list = Array.isArray(data.campaigns) ? data.campaigns.map(mapRemote) : [];
      this.cache = list;
      this.cachedAt = Date.now();
      this.degraded = false;
      return list;
    } catch {
      // Réseau indisponible : on garde le dernier état connu et on le signale.
      this.degraded = true;
      return this.cache ?? [];
    } finally {
      clearTimeout(timer);
    }
  }

  async listCampaigns(): Promise<CampaignRecord[]> {
    return this.fetchCampaigns();
  }

  async findById(campaignId: string): Promise<CampaignRecord | null> {
    const normalized = normalizeCampaignId(campaignId);
    if (!normalized) return null;
    const list = await this.fetchCampaigns();
    return list.find((campaign) => campaign.id.toUpperCase() === normalized) ?? null;
  }

  async findByQrCodeValue(qrValue: string): Promise<CampaignRecord | null> {
    const canonical = canonicalizeValue(qrValue);
    if (canonical.length === 0) return null;
    const list = await this.fetchCampaigns();
    const byValue = list.find((campaign) => canonicalizeValue(campaign.qrCodeValue) === canonical);
    if (byValue) return byValue;
    const embeddedId = normalizeCampaignId(/^(?:qrsc|qrscanner):\/\/(?:campaign\/|ad\/)?([A-Za-z0-9_-]+)$/i.exec(canonical)?.[1] ?? '');
    if (embeddedId) return list.find((campaign) => campaign.id.toUpperCase() === embeddedId) ?? null;
    return null;
  }
}

/** Fabrique du service utilisé par toute l'application. */
export function createCampaignService(): CampaignService {
  return new LocalCampaignService();
}

/** Instance locale partagée (par défaut : hors ligne). */
export const campaignService: CampaignService = createCampaignService();
