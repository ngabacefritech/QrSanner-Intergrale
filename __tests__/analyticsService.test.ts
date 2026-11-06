/**
 * Déclaration de scan : fonction pure + envoi best effort, silencieux,
 * et strictement conditionné par l'activation de la synchronisation.
 */
import { resetApiConfigCache, setApiConfig } from '../src/services/apiConfig';
import { buildScanPayload, reportScan } from '../src/services/analyticsService';

describe('buildScanPayload', () => {
  const now = new Date('2026-02-03T10:20:30.000Z');

  it('normalise l’identifiant et l’horodatage', () => {
    const payload = buildScanPayload(' abcd1234 ', 'embedded', now, 'android', '1.4.2');
    expect(payload).toEqual({
      campaignId: 'ABCD1234',
      source: 'embedded',
      scannedAt: '2026-02-03T10:20:30.000Z',
      platform: 'android',
      appVersion: '1.4.2',
    });
  });

  it('classe les plateformes inconnues en « other »', () => {
    expect(buildScanPayload('ABCD1234', 'registry', now, 'web', '1.0.0')?.platform).toBe('other');
  });

  it.each(['', 'AB', 'id avec espace', '<script>', 'a'.repeat(40)])(
    'refuse un identifiant non conforme (%#)',
    (candidate) => {
      expect(buildScanPayload(candidate, 'registry', now, 'ios', '1.0.0')).toBeNull();
    }
  );
});

describe('reportScan', () => {
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    resetApiConfigCache();
    fetchMock = jest.fn(async () => ({ ok: true, status: 201, json: async () => ({ recorded: true }) }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock as never;
  });

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('ne fait AUCUNE requête tant que la synchronisation est désactivée', async () => {
    const result = await reportScan('ABCD1234', 'embedded');
    expect(result).toEqual({ sent: false, reason: 'Synchronisation désactivée.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie le minimum de données quand la sync est active', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    const result = await reportScan('ABCD1234', 'registry');
    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/api/admin/scans');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['appVersion', 'campaignId', 'platform', 'scannedAt', 'source']);
    expect(body.campaignId).toBe('ABCD1234');
    expect(body.source).toBe('registry');
    expect(body.platform).toBe('ios'); // Platform.OS sous Jest/Expo
    // Aucune donnée personnelle : rien qui ressemble à un token, un email ou une position.
    expect(String(init.body)).not.toMatch(/token|email|latitude|deviceId|session/i);
  });

  it('reste silencieux si le serveur répond en erreur', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    fetchMock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    await expect(reportScan('ABCD1234', 'embedded')).resolves.toMatchObject({ sent: false });
  });

  it('ne lève jamais sur une panne réseau', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    fetchMock.mockImplementation(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(reportScan('ABCD1234', 'embedded')).resolves.toMatchObject({ sent: false });
  });

  it('n’appelle pas l’API pour un identifiant non conforme', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    const result = await reportScan('mauvais id', 'embedded');
    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
