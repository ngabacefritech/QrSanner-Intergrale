import {
  buildAd,
  canAcceptScan,
  QR_ERROR_MESSAGES,
  RESCAN_COOLDOWN_MS,
  resolveQrCode,
} from '../src/services/qrCodeService';
import type { CampaignService } from '../src/services/campaignService';
import { DEMO_CAMPAIGNS, DEMO_CAMPAIGN_IDS } from '../src/constants/campaigns';
import type { CampaignRecord } from '../src/types/campaign';
import { validateMediaUrl } from '../src/utils/validation';

describe('resolveQrCode — cas d’erreur', () => {
  it('refuse un contenu vide ou absent', async () => {
    await expect(resolveQrCode('')).resolves.toMatchObject({ ok: false, code: 'EMPTY_INPUT' });
    await expect(resolveQrCode('    ')).resolves.toMatchObject({ ok: false, code: 'EMPTY_INPUT' });
    await expect(resolveQrCode(null)).resolves.toMatchObject({ ok: false, code: 'EMPTY_INPUT' });
    await expect(resolveQrCode(42)).resolves.toMatchObject({ ok: false, code: 'EMPTY_INPUT' });
  });

  it('refuse un contenu trop long', async () => {
    const result = await resolveQrCode('x'.repeat(3000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LONG');
  });

  it('refuse les contenus non pris en charge (vCard, texte libre)', async () => {
    const vcard = await resolveQrCode('BEGIN:VCARD\nVERSION:3.0\nN:Doe');
    expect(vcard.ok).toBe(false);
    if (!vcard.ok) expect(vcard.code).toBe('UNSUPPORTED_CONTENT');

    const freeText = await resolveQrCode('bonjour le monde');
    expect(freeText.ok).toBe(false);
    if (!freeText.ok) expect(freeText.code).toBe('UNSUPPORTED_CONTENT');
  });

  it('refuse une URL distante inconnue sans jamais l’afficher', async () => {
    const result = await resolveQrCode('https://exemple-malveillant.org/pub.gif');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN_CAMPAIGN');
  });

  it('refuse le média HTTP d’une campagne piégée (motif de sécurité)', async () => {
    const result = await resolveQrCode('http://qrscanner.local:8080/ad.png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNSAFE_URL');
  });

  it('signale une campagne inconnue pour un ID au format valide mais absent', async () => {
    const result = await resolveQrCode('AD-BAD-001');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN_CAMPAIGN');
  });

  it('refuse une campagne inactive', async () => {
    const result = await resolveQrCode('https://qrscanner.local/demo/campagne-inactive');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INACTIVE_CAMPAIGN');
  });

  it('refuse une campagne sans durée valide (registre injecté)', async () => {
    const broken: CampaignRecord = {
      ...DEMO_CAMPAIGNS[0],
      id: 'DEMO-BROKEN-001',
      qrCodeValue: 'DEMO-BROKEN-001',
      durationSeconds: 0,
    };
    const service: CampaignService = {
      kind: 'local',
      degraded: false,
      listCampaigns: async () => [broken],
      findById: async () => broken,
      findByQrCodeValue: async () => broken,
    };
    const result = await resolveQrCode('DEMO-BROKEN-001', service);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_DURATION');
      expect(result.message.length).toBeGreaterThan(10);
      expect(result.message).toBe(QR_ERROR_MESSAGES.INVALID_DURATION);
    }
  });

  it('chaque code d’erreur possède un message français lisible', () => {
    for (const [code, message] of Object.entries(QR_ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/[A-Za-z]_[A-Z]/); // pas de code technique affiché
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('resolveQrCode — cas de succès', () => {
  it('accepte la valeur exacte du registre (campagne image locale)', async () => {
    const result = await resolveQrCode('https://qrscanner.local/demo/nzui-market');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ad.campaignId).toBe(DEMO_CAMPAIGN_IDS.localImage);
      expect(result.ad.mediaType).toBe('image');
      expect(result.ad.mediaSource.kind).toBe('asset');
      expect(result.ad.durationSeconds).toBe(10);
      expect(result.source).toBe('registry');
    }
  });

  it('accepte le schéma applicatif (campagne vidéo locale)', async () => {
    const result = await resolveQrCode('qrscanner://campaign/DEMO-VIDEO-001');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ad.campaignId).toBe(DEMO_CAMPAIGN_IDS.localVideo);
      expect(result.ad.mediaType).toBe('video');
      expect(result.ad.fallbackImage?.kind).toBe('asset');
      expect(result.ad.allowEarlySkip).toBe(false);
    }
  });

  it('accepte l’identifiant brut, casse et espaces ignorés', async () => {
    const upper = await resolveQrCode('DEMO-IMAGE-001');
    const lower = await resolveQrCode('  demo-image-001 ');
    expect(upper.ok).toBe(true);
    expect(lower.ok).toBe(true);
    if (upper.ok && lower.ok) expect(upper.ad.campaignId).toBe(lower.ad.campaignId);
  });

  it('accepte une URL du domaine de démo pointant vers un ID connu', async () => {
    const result = await resolveQrCode('https://qrscanner.local/demo/DEMO-IMAGE-001');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ad.campaignId).toBe(DEMO_CAMPAIGN_IDS.localImage);
  });

  it('refuse à l’affichage le média d’une campagne dont l’URL viole la politique HTTPS', async () => {
    // La valeur exacte est bien enregistrée, mais le média ne passe pas
    // la validation de sécurité : buildAd + isAllowedMedia refusent à l'écran.
    const result = await resolveQrCode('http://localhost:8080/ad.png');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ad.campaignId).toBe(DEMO_CAMPAIGN_IDS.badUrl);
      if (result.ad.mediaSource.kind === 'remote') {
        // Contrôle de sécurité de dernier rempart : l'écran refusera cette source.
        expect(validateMediaUrl(result.ad.mediaSource.url)).toMatchObject({ ok: false });
        const { resolveMediaSource } = require('../src/utils/media');
        expect(resolveMediaSource(result.ad.mediaSource)).toBe(null);
      }
    }
  });

  it('normalise les données de publicité (jamais undefined sur un succès)', async () => {
    const result = await resolveQrCode('DEMO-VIDEO-001');
    if (!result.ok) throw new Error('le scan devrait réussir');
    expect(typeof result.ad.title).toBe('string');
    expect(result.ad.durationSeconds).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(result.ad.durationSeconds)).toBe(true);
  });

  it('un QR ne peut déclencher qu’une campagne : pas d’URL directe non déclarée', async () => {
    const direct = await resolveQrCode('https://picsum.photos/seed/inconnu/640/640');
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.code).toBe('UNKNOWN_CAMPAIGN');
  });

  it('la résolution d’URL directe accepte une URL déclarée par une campagne qui l’autorise', async () => {
    const permissive: CampaignRecord = {
      ...DEMO_CAMPAIGNS[0],
      id: 'DEMO-DIRECT-001',
      qrCodeValue: 'DEMO-DIRECT-001',
      mediaType: 'image',
      mediaSource: { kind: 'remote', url: 'https://cdn.exemple.org/pub-directe.png' },
      allowDirectUrlMedia: true,
    };
    const service: CampaignService = {
      kind: 'local',
      degraded: false,
      listCampaigns: async () => [permissive],
      findById: async () => permissive,
      findByQrCodeValue: async () => null,
    };
    const result = await resolveQrCode('https://cdn.exemple.org/pub-directe.png', service);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('direct-url');
      expect(result.ad.campaignId).toBe('DEMO-DIRECT-001');
    }
  });
});

describe('buildAd — projection enregistrement → publicité', () => {
  it('rejette les durées invalides', () => {
    const invalid: CampaignRecord = { ...DEMO_CAMPAIGNS[0], durationSeconds: 0 };
    expect(buildAd(invalid)).toBe(null);
    const fractional: CampaignRecord = { ...DEMO_CAMPAIGNS[0], durationSeconds: 9.5 };
    expect(buildAd(fractional)).toBe(null);
  });

  it('produit une publicité complète et cohérente', () => {
    const ad = buildAd(DEMO_CAMPAIGNS[0]);
    expect(ad).not.toBe(null);
    if (ad) {
      expect(ad.campaignId).toBe(DEMO_CAMPAIGNS[0].id);
      expect(ad.allowEarlySkip).toBe(false);
    }
  });
});

describe('canAcceptScan — anti double-scan', () => {
  const NOW = 1_000_000;

  it('bloque tant qu’un scan est en cours', () => {
    expect(
      canAcceptScan({ value: 'A', lastValue: null, lastAt: null, inFlight: true, now: NOW })
    ).toBe(false);
  });

  it('bloque le même code pendant le cooldown, autorise ensuite', () => {
    const base = { value: 'DEMO-IMAGE-001', lastValue: 'DEMO-IMAGE-001', lastAt: NOW, inFlight: false, now: NOW };
    expect(canAcceptScan(base)).toBe(false);
    expect(canAcceptScan({ ...base, now: NOW + RESCAN_COOLDOWN_MS - 1 })).toBe(false);
    expect(canAcceptScan({ ...base, now: NOW + RESCAN_COOLDOWN_MS })).toBe(true);
  });

  it('autorise immédiatement un code différent', () => {
    expect(
      canAcceptScan({ value: 'B', lastValue: 'A', lastAt: NOW, inFlight: false, now: NOW })
    ).toBe(true);
  });

  it('autorise à nouveau après réarmement (état réinitialisé au retour du scanner)', () => {
    expect(canAcceptScan({ value: 'A', lastValue: null, lastAt: null, inFlight: false, now: NOW })).toBe(true);
  });

  it('le cooldown par défaut est de 2,5 s', () => {
    expect(RESCAN_COOLDOWN_MS).toBe(2500);
  });
});
