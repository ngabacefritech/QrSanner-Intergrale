import { resolveMediaSource } from '../src/utils/media';

describe('resolveMediaSource', () => {
  it('résout un asset local via le resolveur fourni (Metro en production)', () => {
    const resolver = (key: number | string) => ({ uri: `mocked://asset/${key}` });
    expect(resolveMediaSource({ kind: 'asset', assetKey: 7 }, resolver)).toEqual({
      uri: 'mocked://asset/7',
      remote: false,
    });
  });

  it('retourne null si le resolveur ne connaît pas l’asset', () => {
    expect(resolveMediaSource({ kind: 'asset', assetKey: 42 }, () => null)).toBe(null);
    expect(resolveMediaSource({ kind: 'asset', assetKey: 42 }, () => ({}))).toBe(null);
  });

  it('accepte une URL HTTPS distante après validation', () => {
    const resolved = resolveMediaSource({ kind: 'remote', url: 'https://cdn.exemple.org/clip.mp4' });
    expect(resolved).toEqual({ uri: 'https://cdn.exemple.org/clip.mp4', remote: true });
  });

  it('refuse une URL distante non sécurisée (aucun chargement)', () => {
    expect(resolveMediaSource({ kind: 'remote', url: 'http://exemple.org/clip.mp4' })).toBe(null);
    expect(resolveMediaSource({ kind: 'remote', url: 'javascript:alert(1)' })).toBe(null);
    expect(resolveMediaSource({ kind: 'remote', url: 'non-sens' })).toBe(null);
  });

  it('retourne null si la source est absente', () => {
    expect(resolveMediaSource(undefined)).toBe(null);
  });
});
