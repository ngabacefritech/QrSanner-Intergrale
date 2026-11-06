/**
 * Configuration réseau : validation de l'URL et persistance.
 * Rien n'est envoyé sans activation explicite ; le HTTP public est refusé.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  API_CONFIG_STORAGE_KEY,
  DEFAULT_API_CONFIG,
  getApiConfig,
  loadApiConfig,
  resetApiConfigCache,
  saveApiConfig,
  setApiConfig,
  validateApiBaseUrl,
} from '../src/services/apiConfig';

describe('validateApiBaseUrl — politique de sécurité', () => {
  it('accepte HTTPS public et normalise (slash final retiré)', () => {
    const result = validateApiBaseUrl('https://pub.exemple.org/api/');
    expect(result).toEqual({ ok: true, baseUrl: 'https://pub.exemple.org/api' });
  });

  it.each([
    ['http://localhost:4000', 'http://localhost:4000'],
    ['http://127.0.0.1:4000', 'http://127.0.0.1:4000'],
    ['http://192.168.1.20:4000', 'http://192.168.1.20:4000'],
    ['http://10.0.0.5:4000', 'http://10.0.0.5:4000'],
    ['http://172.16.0.9:4000', 'http://172.16.0.9:4000'],
  ])('autorise le HTTP de développement %s', (raw, expected) => {
    expect(validateApiBaseUrl(raw)).toEqual({ ok: true, baseUrl: expected });
  });

  it('refuse le HTTP public', () => {
    const result = validateApiBaseUrl('http://pub.exemple.org');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('HTTP autorisé uniquement en local');
  });

  it.each([
    ['vide', ''],
    ['schéma interdit', 'ftp://exemple.org'],
    ['identifiants dans l’URL', 'https://user:pass@exemple.org'],
    ['pas une URL', 'exemple.org'],
    ['trop long', `https://a${'b'.repeat(250)}.org`],
  ])('refuse : %s', (_label, raw) => {
    expect(validateApiBaseUrl(raw).ok).toBe(false);
  });
});

describe('persistance de la configuration', () => {
  beforeEach(async () => {
    resetApiConfigCache();
    await AsyncStorage.clear();
  });

  it('absence de configuration = défaut désactivé', async () => {
    expect(await loadApiConfig()).toEqual(DEFAULT_API_CONFIG);
  });

  it('enregistre puis relit une configuration activée', async () => {
    await saveApiConfig({ baseUrl: 'http://localhost:4000/', enabled: true });
    expect(await loadApiConfig()).toEqual({ baseUrl: 'http://localhost:4000', enabled: true });
  });

  it('refuse d’enregistrer une URL non conforme', async () => {
    const saved = await saveApiConfig({ baseUrl: 'http://pub.exemple.org', enabled: true });
    expect(saved).toEqual(DEFAULT_API_CONFIG);
  });

  it('ignore une configuration corrompue ou mensongère', async () => {
    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, 'pas du json');
    expect(await loadApiConfig()).toEqual(DEFAULT_API_CONFIG);

    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify({ baseUrl: 'https://x.org', enabled: false }));
    expect(await loadApiConfig()).toEqual(DEFAULT_API_CONFIG);

    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify({ baseUrl: 42, enabled: true }));
    expect(await loadApiConfig()).toEqual(DEFAULT_API_CONFIG);
  });

  it('getApiConfig met le résultat en cache jusqu’à réinitialisation', async () => {
    expect((await getApiConfig()).enabled).toBe(false);
    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify({ baseUrl: 'https://y.org', enabled: true }));
    expect((await getApiConfig()).enabled).toBe(false); // toujours la valeur en cache
    resetApiConfigCache();
    expect((await getApiConfig()).enabled).toBe(true);
  });

  it('setApiConfig rafraîchit le cache et permet la coupure', async () => {
    const enabled = await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    expect(enabled).toEqual({ baseUrl: 'http://localhost:4000', enabled: true });
    expect((await getApiConfig()).enabled).toBe(true);

    const off = await setApiConfig({ baseUrl: '', enabled: false });
    expect(off).toEqual(DEFAULT_API_CONFIG);
    expect((await getApiConfig()).enabled).toBe(false);
  });
});
