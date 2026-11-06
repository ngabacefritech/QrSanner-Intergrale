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

describe('RemoteCampaignService — registre distant (API de la console)', () => {
  const base = 'https://api.exemple.org';
  const dto = {
    id: 'abcd1234',
    title: 'Offre nuit',
    description: null,
    mediaType: 'video',
    mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
    fallbackUrl: null,
    durationSeconds: 12,
    isActive: true,
    allowEarlySkip: true,
    createdAt: '2026-01-04T10:00:00.000Z',
    qrText: 'qrsc://ABCD1234',
  };

  function stubFetch(handler: () => Promise<unknown>) {
    const mock = jest.fn(handler);
    (globalThis as { fetch?: unknown }).fetch = mock as never;
    return mock;
  }

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('refuse toute base URL non HTTPS', () => {
    expect(() => new RemoteCampaignService('http://api.exemple.org')).toThrow();
    expect(() => new RemoteCampaignService('https://api.exemple.org')).not.toThrow();
    // le HTTP de développement (réseau local) est en revanche autorisé
    expect(() => new RemoteCampaignService('http://192.168.1.20:4000')).not.toThrow();
  });

  it('interroge GET /api/campaigns et normalise la réponse', async () => {
    const mock = stubFetch(async () => ({ ok: true, json: async () => ({ campaigns: [dto] }) }));
    const service = new RemoteCampaignService(base);
    const list = await service.listCampaigns();

    expect(mock).toHaveBeenCalledWith(`${base}/api/campaigns`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: expect.anything(),
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'ABCD1234',
      title: 'Offre nuit',
      mediaType: 'video',
      mediaSource: { kind: 'remote', url: 'https://cdn.exemple.org/nuit.mp4' },
      durationSeconds: 12,
      isActive: true,
      allowEarlySkip: true,
      qrCodeValue: 'qrsc://ABCD1234',
    });
    expect(service.degraded).toBe(false);
  });

  it('fabrique qrsc://<ID> lorsque le serveur ne renvoie pas qrText', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ campaigns: [{ ...dto, qrText: undefined }] }) }));
    const service = new RemoteCampaignService(base);
    const list = await service.listCampaigns();
    expect(list[0]?.qrCodeValue).toBe('qrsc://ABCD1234');
  });

  it('met « degraded » et conserve le dernier état connu en cas de panne réseau', async () => {
    let calls = 0;
    const mock = stubFetch(async () => {
      calls += 1;
      if (calls === 1) return { ok: true, json: async () => ({ campaigns: [dto] }) };
      throw new Error('ECONNREFUSED');
    });
    const service = new RemoteCampaignService(base, 0); // cache expiré immédiatement

    expect(await service.listCampaigns()).toHaveLength(1);
    const fallback = await service.listCampaigns();
    expect(fallback).toHaveLength(1); // dernier état connu
    expect(service.degraded).toBe(true);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('ne rappelle pas l API dans la fenêtre de cache', async () => {
    const mock = stubFetch(async () => ({ ok: true, json: async () => ({ campaigns: [dto] }) }));
    const service = new RemoteCampaignService(base, 30_000);
    await service.listCampaigns();
    await service.findById('ABCD1234');
    await service.findByQrCodeValue('qrsc://ABCD1234');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('trouve par valeur de QR et renvoie null pour un inconnu', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ campaigns: [dto] }) }));
    const service = new RemoteCampaignService(base);
    expect((await service.findByQrCodeValue('QRSC://abcd1234 '))?.id).toBe('ABCD1234');
    expect(await service.findByQrCodeValue('qrsc://INCONNU9')).toBe(null);
    expect(await service.findById('')).toBe(null);
  });
});
