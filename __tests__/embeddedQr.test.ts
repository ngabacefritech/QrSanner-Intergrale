/**
 * QR « autonome » : le JSON embarqué produit par la console doit être validé
 * strictement (schéma, sécurité des URLs, bornes) sans jamais être exécuté.
 */
import {
  looksLikeEmbeddedJson,
  parseEmbeddedQr,
} from '../src/services/embeddedQr';

function payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'qrscanner',
    v: 1,
    id: 'ABCD1234',
    t: 'Offre de nuit',
    m: 1,
    u: 'https://cdn.exemple.org/nuit.mp4',
    d: 15,
    ...overrides,
  });
}

describe('looksLikeEmbeddedJson', () => {
  it('reconnaît une forme JSON, sans plus', () => {
    expect(looksLikeEmbeddedJson(payload())).toBe(true);
    expect(looksLikeEmbeddedJson('qrsc://ABCD1234')).toBe(false);
    expect(looksLikeEmbeddedJson('{ pas du json')).toBe(false);
    expect(looksLikeEmbeddedJson('   ')).toBe(false);
  });
});

describe('parseEmbeddedQr — contenu valide', () => {
  it('ignore le JSON qui vient d’ailleurs', () => {
    expect(parseEmbeddedQr('{"bonjour":1}')).toEqual({ status: 'not-embedded' });
    expect(parseEmbeddedQr('https://qrscanner.local/demo/ABCD1234')).toEqual({ status: 'not-embedded' });
  });

  it('normalise une campagne complète', () => {
    const result = parseEmbeddedQr(payload({ s: 'Remise -20 %', f: 'https://cdn.exemple.org/logo.jpg', k: 1 }));
    expect(result).toEqual({
      status: 'ok',
      campaign: {
        id: 'ABCD1234',
        title: 'Offre de nuit',
        mediaType: 'video',
        mediaUrl: 'https://cdn.exemple.org/nuit.mp4',
        durationSeconds: 15,
        description: 'Remise -20 %',
        fallbackUrl: 'https://cdn.exemple.org/logo.jpg',
        allowEarlySkip: true,
      },
    });
  });

  it('accepte une image sans option et coupe les espaces', () => {
    const result = parseEmbeddedQr(payload({ m: 0, t: '  Titre  ', d: 1, id: 'abcd-1234_x' }));
    if (result.status !== 'ok') throw new Error(`attendu ok, reçu ${JSON.stringify(result)}`);
    expect(result.campaign.mediaType).toBe('image');
    expect(result.campaign.title).toBe('Titre');
    expect(result.campaign.id).toBe('ABCD-1234_X');
    expect(result.campaign.allowEarlySkip).toBe(false);
    expect(result.campaign.description).toBeNull();
  });
});

describe('parseEmbeddedQr — rejets de sécurité', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['version inconnue', { v: 2 }, 'VERSION_INCOMPATIBLE'],
    ['identifiant trop court', { id: 'AB' }, 'IDENTIFIANT_INVALIDE'],
    ['identifiant avec espace', { id: 'AB CD1234' }, 'IDENTIFIANT_INVALIDE'],
    ['titre vide', { t: '   ' }, 'TITRE_INVALIDE'],
    ['type de média inconnu', { m: 7 }, 'TYPE_DE_MEDIA_INVALIDE'],
    ['média en HTTP', { u: 'http://cdn.exemple.org/nuit.mp4' }, 'URL_MEDIA_NON_SECURISEE'],
    ['média en javascript:', { u: 'javascript:alert(1)' }, 'URL_MEDIA_NON_SECURISEE'],
    ['média absent', { u: undefined }, 'URL_MEDIA_NON_SECURISEE'],
    ['durée nulle', { d: 0 }, 'DUREE_INVALIDE'],
    ['durée démesurée', { d: 3000 }, 'DUREE_INVALIDE'],
    ['durée non entière', { d: 10.5 }, 'DUREE_INVALIDE'],
    ['réplique non sécurisée', { f: 'ftp://cdn.exemple.org/x.jpg' }, 'URL_DE_REPLI_NON_SECURISEE'],
    ['champs de sécurité injectés', { t: 'Titre\u0000script' }, 'TITRE_INVALIDE'],
  ];

  it.each(cases)('refuse : %s', (_label, override, reason) => {
    const result = parseEmbeddedQr(payload(override));
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.reason).toContain(reason);
  });

  it('refuse un JSON invalide malgré l’apparence', () => {
    expect(parseEmbeddedQr('{"app":"qrscanner","v":1,}')).toEqual({ status: 'invalid', reason: 'JSON_INVALIDE' });
  });

  it('refuse un contenu trop long (protection DoS)', () => {
    const huge = payload({ s: 'x'.repeat(5000) });
    expect(parseEmbeddedQr(huge)).toEqual({ status: 'invalid', reason: 'CONTENU_TROP_LONG' });
  });

  it('compte les octets UTF-8, pas les caractères', () => {
    const accented = payload({ s: 'é'.repeat(1400) }); // 1400×3 octets > 4096
    expect(parseEmbeddedQr(accented).status).toBe('invalid');
  });
});
