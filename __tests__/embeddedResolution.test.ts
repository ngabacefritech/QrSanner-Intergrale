/**
 * Politique de résolution des QR « autonomes » émis par la console :
 * le registre fait foi quand il est joignable, sinon le contenu validé du QR
 * permet malgré tout d'afficher la publicité (mode hors ligne).
 */
import type { CampaignRecord } from '../src/types/campaign';
import type { CampaignService } from '../src/services/campaignService';
import { buildAdFromEmbedded, resolveQrCode } from '../src/services/qrCodeService';

function record(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: 'ABCD1234',
    title: 'Offre de nuit',
    qrCodeValue: 'qrsc://ABCD1234',
    mediaType: 'video',
    mediaSource: { kind: 'remote', url: 'https://cdn.exemple.org/nuit.mp4' },
    durationSeconds: 15,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    allowDirectUrlMedia: false,
    allowEarlySkip: false,
    ...overrides,
  };
}

function fakeService(campaign: CampaignRecord | null, options: { kind?: 'local' | 'remote'; degraded?: boolean } = {}): CampaignService {
  return {
    kind: options.kind ?? 'remote',
    degraded: options.degraded ?? false,
    listCampaigns: async () => (campaign ? [campaign] : []),
    findById: async () => campaign,
    findByQrCodeValue: async () => campaign,
  };
}

const EMBEDDED = JSON.stringify({
  app: 'qrscanner',
  v: 1,
  id: 'ABCD1234',
  t: 'Offre de nuit',
  m: 1,
  u: 'https://cdn.exemple.org/nuit.mp4',
  d: 15,
  s: 'Remise immédiate',
  k: 1,
});

describe('buildAdFromEmbedded', () => {
  it('convertit un QR validé en publicité normalisée', () => {
    const ad = buildAdFromEmbedded({
      id: 'ABCD1234',
      title: 'Offre de nuit',
      mediaType: 'image',
      mediaUrl: 'https://cdn.exemple.org/visuel.jpg',
      durationSeconds: 8,
      description: null,
      fallbackUrl: 'https://cdn.exemple.org/repli.jpg',
      allowEarlySkip: false,
    });
    expect(ad).toMatchObject({
      campaignId: 'ABCD1234',
      mediaType: 'image',
      mediaSource: { kind: 'remote', url: 'https://cdn.exemple.org/visuel.jpg' },
      durationSeconds: 8,
      allowEarlySkip: false,
    });
    expect(ad.fallbackImage).toEqual({ kind: 'remote', url: 'https://cdn.exemple.org/repli.jpg' });
    expect(ad.description).toBeUndefined();
  });
});

describe('resolveQrCode — QR autonome', () => {
  it('hors registre distant : le contenu du QR suffit (mode hors ligne)', async () => {
    const resolution = await resolveQrCode(EMBEDDED, fakeService(null, { degraded: true }));
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.source).toBe('embedded');
      expect(resolution.ad).toMatchObject({
        campaignId: 'ABCD1234',
        durationSeconds: 15,
        allowEarlySkip: true,
        description: 'Remise immédiate',
      });
    }
  });

  it('registre local (démo) : le QR est accepté tel quel', async () => {
    const resolution = await resolveQrCode(EMBEDDED, fakeService(null, { kind: 'local' }));
    expect(resolution.ok && resolution.source).toBe('embedded');
  });

  it('registre joignable : c’est lui qui fait foi (données du serveur conservées)', async () => {
    const resolution = await resolveQrCode(
      EMBEDDED,
      fakeService(record({ title: 'Titre du serveur', durationSeconds: 20 }))
    );
    expect(resolution.ok && resolution.source).toBe('registry');
    expect(resolution.ok && resolution.ad.title).toBe('Titre du serveur');
    expect(resolution.ok && resolution.ad.durationSeconds).toBe(20);
  });

  it('campagne retirée du registre → UNKNOWN_CAMPAIGN', async () => {
    const resolution = await resolveQrCode(EMBEDDED, fakeService(null));
    expect(resolution).toMatchObject({ ok: false, code: 'UNKNOWN_CAMPAIGN' });
  });

  it('campagne désactivée → INACTIVE_CAMPAIGN', async () => {
    const resolution = await resolveQrCode(EMBEDDED, fakeService(record({ isActive: false })));
    expect(resolution).toMatchObject({ ok: false, code: 'INACTIVE_CAMPAIGN' });
  });

  it('registre joignable mais campagne à durée invalide → INVALID_DURATION', async () => {
    const resolution = await resolveQrCode(EMBEDDED, fakeService(record({ durationSeconds: 0 })));
    expect(resolution).toMatchObject({ ok: false, code: 'INVALID_DURATION' });
  });

  it('JSON reconnu mais non conforme → message explicite', async () => {
    const bad = JSON.stringify({ app: 'qrscanner', v: 1, id: 'ABCD1234', t: 'X', m: 1, u: 'http://evil/nuit.mp4', d: 15 });
    const resolution = await resolveQrCode(bad, fakeService(null, { kind: 'local' }));
    expect(resolution).toMatchObject({ ok: false, code: 'EMBEDDED_INVALID' });
    if (!resolution.ok) expect(resolution.message).toContain('format');
  });

  it('un texte libre avec espaces reste refusé, même entre accolades', async () => {
    const resolution = await resolveQrCode('{"bonjour":"le monde"}', fakeService(null, { kind: 'local' }));
    expect(resolution.ok).toBe(false);
  });

  it('le mode « identifiant court » du registre local continue de fonctionner', async () => {
    const service = fakeService(record({ qrCodeValue: 'qrsc://ABCD1234' }), { kind: 'local' });
    const resolution = await resolveQrCode('qrsc://ABCD1234', service);
    expect(resolution.ok && resolution.source).toBe('registry');
  });
});
