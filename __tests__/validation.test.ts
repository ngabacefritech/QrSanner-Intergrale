import {
  clampDuration,
  extractCampaignIdFromUrl,
  isValidDurationSeconds,
  isValidQrText,
  looksLikeUrl,
  normalizeCampaignId,
  validateMediaUrl,
  MAX_QR_LENGTH,
} from '../src/utils/validation';

describe('isValidQrText — validation du contenu QR', () => {
  it('rejette les valeurs vides ou absentes', () => {
    expect(isValidQrText('')).toBe(false);
    expect(isValidQrText('   ')).toBe(false);
    expect(isValidQrText(null)).toBe(false);
    expect(isValidQrText(undefined)).toBe(false);
    expect(isValidQrText(42)).toBe(false);
  });

  it('rejette les contenus trop longs', () => {
    expect(isValidQrText('a'.repeat(MAX_QR_LENGTH + 1))).toBe(false);
    expect(isValidQrText('a'.repeat(MAX_QR_LENGTH))).toBe(true);
  });

  it('rejette les caractères de contrôle', () => {
    expect(isValidQrText(`https://qrscanner.local/demo/x${String.fromCharCode(0)}`)).toBe(false);
    expect(isValidQrText(`ligne1${String.fromCharCode(13)}ligne2`)).toBe(false);
  });

  it('rejette les contenus déclencheurs système (vCard, MeCard, WiFi, Bluetooth)', () => {
    expect(isValidQrText('BEGIN:VCARD\nVERSION:3.0')).toBe(false);
    expect(isValidQrText('MECARD:N:Doe;John;;')).toBe(false);
    expect(isValidQrText('WIFI:S:Reseau;T:WPA;P:secret;;')).toBe(false);
    expect(isValidQrText('BEGIN:BLUETOOTH:PAIRING')).toBe(false);
  });

  it('accepte une URL et un identifiant normaux', () => {
    expect(isValidQrText('https://qrscanner.local/demo/nzui-market')).toBe(true);
    expect(isValidQrText('DEMO-IMAGE-001')).toBe(true);
  });
});

describe('normalizeCampaignId — identifiants', () => {
  it('normalise casse et espaces', () => {
    expect(normalizeCampaignId('  demo-image-001 ')).toBe('DEMO-IMAGE-001');
  });

  it('rejette les identifiants mal formés', () => {
    expect(normalizeCampaignId('a')).toBe(null);
    expect(normalizeCampaignId('trop long avec espaces')).toBe(null);
    expect(normalizeCampaignId('DEMO IMAGE 001')).toBe(null);
    expect(normalizeCampaignId('../../etc/passwd')).toBe(null);
    expect(normalizeCampaignId('<script>')).toBe(null);
    expect(normalizeCampaignId(null)).toBe(null);
  });
});

describe('looksLikeUrl / extractCampaignIdFromUrl', () => {
  it('détecte les URL http(s)', () => {
    expect(looksLikeUrl('https://exemple.org/a')).toBe(true);
    expect(looksLikeUrl('DEMO-IMAGE-001')).toBe(false);
    expect(looksLikeUrl('javascript:alert(1)')).toBe(false);
  });

  it('extrait l’ID depuis le schéma applicatif qrscanner://', () => {
    expect(extractCampaignIdFromUrl('qrscanner://campaign/DEMO-VIDEO-001')).toBe('DEMO-VIDEO-001');
    expect(extractCampaignIdFromUrl('qrscanner://ad/DEMO-IMAGE-001')).toBe('DEMO-IMAGE-001');
    expect(extractCampaignIdFromUrl('qrscanner://campaign/../evil')).toBe(null);
  });

  it('extrait l’ID depuis les URL du domaine de démonstration', () => {
    // « nzui-market » a un format d'ID valide : l'extraction accepte, la recherche
    // en registre est inutile ici (la valeur exacte matche déjà la campagne).
    expect(extractCampaignIdFromUrl('https://qrscanner.local/demo/nzui-market')).toBe('NZUI-MARKET');
    expect(extractCampaignIdFromUrl('https://qrscanner.local/demo/DEMO-IMAGE-001')).toBe('DEMO-IMAGE-001');
    expect(extractCampaignIdFromUrl('https://qrscanner.local/campaign/DEMO-VIDEO-001')).toBe('DEMO-VIDEO-001');
    expect(extractCampaignIdFromUrl('https://evil.example/demo/DEMO-IMAGE-001')).toBe(null);
    expect(extractCampaignIdFromUrl('http://qrscanner.local/demo/DEMO-IMAGE-001')).toBe('DEMO-IMAGE-001');
  });
});

describe('validateMediaUrl — normalisation et sécurité des URLs distantes', () => {
  it('accepte HTTPS', () => {
    const result = validateMediaUrl('https://cdn.exemple.org/pub/clip.mp4');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://cdn.exemple.org/pub/clip.mp4');
  });

  it('refuse les schémas dangereux', () => {
    expect(validateMediaUrl('javascript:alert(1)')).toEqual({ ok: false, reason: 'SCHEME' });
    expect(validateMediaUrl('file:///etc/passwd')).toEqual({ ok: false, reason: 'SCHEME' });
    expect(validateMediaUrl('data:image/png;base64,AAAA')).toEqual({ ok: false, reason: 'SCHEME' });
    expect(validateMediaUrl('intent://scan/#Intent')).toEqual({ ok: false, reason: 'SCHEME' });
  });

  it('refuse HTTP hors localhost (et accepte localhost en développement)', () => {
    expect(validateMediaUrl('http://exemple.org/pub.png')).toEqual({ ok: false, reason: 'SCHEME' });
    expect(validateMediaUrl('http://localhost:8081/pub.png').ok).toBe(true);
    expect(validateMediaUrl('http://127.0.0.1:19000/pub.png').ok).toBe(true);
  });

  it('refuse les identifiants dans l’URL et les ports inhabituels', () => {
    expect(validateMediaUrl('https://user:pass@cdn.exemple.org/a.png')).toEqual({ ok: false, reason: 'INVALID' });
    expect(validateMediaUrl('https://cdn.exemple.org:8443/a.png')).toEqual({ ok: false, reason: 'INVALID' });
    expect(validateMediaUrl('https://cdn.exemple.org:443/a.png').ok).toBe(true);
  });

  it('refuse les hôtes invalides et les entrées non texte', () => {
    // localhost/127.0.0.1 sont admis en développement (prévisualisation Metro),
    // y compris en HTTPS : c'est volontaire et documenté dans le README.
    expect(validateMediaUrl('https://localhost/a.png').ok).toBe(true);
    expect(validateMediaUrl('https://nodots')).toEqual({ ok: false, reason: 'HOST' });
    expect(validateMediaUrl('')).toEqual({ ok: false, reason: 'INVALID' });
    expect(validateMediaUrl('https://exemple.org/avec espace.png')).toEqual({ ok: false, reason: 'INVALID' });
    expect(validateMediaUrl(undefined)).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('normalise la valeur acceptée (href canonical)', () => {
    const result = validateMediaUrl('https://CDN.Exemple.ORG/pub/clip.mp4?x=1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe('https://cdn.exemple.org/pub/clip.mp4?x=1');
  });
});

describe('durées de campagne', () => {
  it('isValidDurationSeconds exige un entier entre 1 et 300', () => {
    expect(isValidDurationSeconds(10)).toBe(true);
    expect(isValidDurationSeconds(0)).toBe(false);
    expect(isValidDurationSeconds(-3)).toBe(false);
    expect(isValidDurationSeconds(4.5)).toBe(false);
    expect(isValidDurationSeconds(Number.NaN)).toBe(false);
    expect(isValidDurationSeconds(301)).toBe(false);
    expect(isValidDurationSeconds('10')).toBe(false);
  });

  it('clampDuration ramène dans la plage avec défaut', () => {
    expect(clampDuration(7200)).toBe(300);
    expect(clampDuration(0)).toBe(1);
    expect(clampDuration(-5)).toBe(1);
    expect(clampDuration(42)).toBe(42);
    expect(clampDuration('x', 7)).toBe(7);
    expect(clampDuration(undefined, 10)).toBe(10);
  });
});
