import {
  createCampaignService,
  campaignService,
  LocalCampaignService,
  RemoteCampaignService,
} from '../src/services/campaignService';
import { DEMO_CAMPAIGNS, DEMO_CAMPAIGN_IDS } from '../src/constants/campaigns';
import { validateMediaUrl } from '../src/utils/validation';

describe('LocalCampaignService — recherche dans le registre de démonstration', () => {
  const service = new LocalCampaignService();

  it('trouve par identifiant, casse et espaces ignorés', async () => {
    const found = await service.findById(' demo-image-001 ');
    expect(found?.id).toBe(DEMO_CAMPAIGN_IDS.localImage);
    expect(await service.findById('n-existe-pas')).toBe(null);
    expect(await service.findById('<script>')).toBe(null);
  });

  it('trouve par valeur exacte de QR', async () => {
    const found = await service.findByQrCodeValue('https://qrscanner.local/demo/nzui-market');
    expect(found?.id).toBe(DEMO_CAMPAIGN_IDS.localImage);
    expect(await service.findByQrCodeValue('https://exemple.org/inconnu')).toBe(null);
    expect(await service.findByQrCodeValue('   ')).toBe(null);
  });

  it('liste toutes les campagnes de démo avec les champs requis', async () => {
    const list = await service.listCampaigns();
    expect(list.length).toBeGreaterThanOrEqual(4);
    for (const campaign of list) {
      expect(typeof campaign.id).toBe('string');
      expect(typeof campaign.title).toBe('string');
      expect(typeof campaign.qrCodeValue).toBe('string');
      expect(['image', 'video']).toContain(campaign.mediaType);
      expect(['asset', 'remote']).toContain(campaign.mediaSource.kind);
      expect(Number.isInteger(campaign.durationSeconds)).toBe(true);
      expect(typeof campaign.isActive).toBe('boolean');
      expect(!Number.isNaN(Date.parse(campaign.createdAt))).toBe(true);
    }
  });

  it('la fabrique utilisée par l’application renvoie bien le registre local', async () => {
    expect(createCampaignService()).toBeInstanceOf(LocalCampaignService);
    expect(await campaignService.findById(DEMO_CAMPAIGN_IDS.localVideo)).toBeTruthy();
  });

  it('le registre contient au moins une pub image et une pub vidéo actives avec QR de test', () => {
    const image = DEMO_CAMPAIGNS.find((c) => c.mediaType === 'image' && c.isActive);
    const video = DEMO_CAMPAIGNS.find((c) => c.mediaType === 'video' && c.isActive);
    expect(image?.qrCodeValue.length).toBeGreaterThan(5);
    expect(video?.qrCodeValue.length).toBeGreaterThan(5);
  });

  it('les médias distants du registre passent (ou sont refusés explicitement par) la politique HTTPS', async () => {
    const list = await campaignService.listCampaigns();
    const remoteCampaigns = list.filter((campaign) => campaign.mediaSource.kind === 'remote');
    expect(remoteCampaigns.length).toBeGreaterThanOrEqual(2);
    for (const campaign of remoteCampaigns) {
      if (campaign.mediaSource.kind !== 'remote') continue;
      if (campaign.id === DEMO_CAMPAIGN_IDS.badUrl) {
        // Campagne « piégée » : son média doit être refusé par la validation de sécurité.
        expect(validateMediaUrl(campaign.mediaSource.url).ok).toBe(false);
      } else {
        expect(validateMediaUrl(campaign.mediaSource.url).ok).toBe(true);
      }
    }
  });
});

describe('RemoteCampaignService — contrat futur (aucun serveur en V1)', () => {
  it('refuse toute base URL non HTTPS', () => {
    expect(() => new RemoteCampaignService('http://api.exemple.org')).toThrow();
    expect(() => new RemoteCampaignService('https://api.exemple.org')).not.toThrow();
  });

  it('appelle l’API distante avec fetch quand on l’utilise explicitement', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => [DEMO_CAMPAIGNS[0]],
    }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock as never;
    const service = new RemoteCampaignService('https://api.exemple.org');
    const list = await service.listCampaigns();
    expect(list).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.exemple.org/campaigns', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    delete (globalThis as { fetch?: unknown }).fetch;
  });
});
