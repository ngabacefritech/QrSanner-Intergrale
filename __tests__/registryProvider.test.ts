/**
 * Choix du registre selon la configuration : local par défaut, distant une fois
 * la synchronisation activée, avec instance mémoïsée (cache partagé).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetApiConfigCache, setApiConfig } from '../src/services/apiConfig';
import { getCampaignService, resetRegistryProvider } from '../src/services/registryProvider';

describe('getCampaignService', () => {
  beforeEach(async () => {
    resetRegistryProvider();
    resetApiConfigCache();
    await AsyncStorage.clear();
  });

  it('utilise le registre local embarqué par défaut', async () => {
    const service = await getCampaignService();
    expect(service.kind).toBe('local');
    expect(service.degraded).toBe(false);
    expect((await service.listCampaigns()).length).toBeGreaterThan(0);
  });

  it('bascule sur le registre distant dès que la sync est activée', async () => {
    let fetched = 0;
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => {
      fetched += 1;
      return {
        ok: true,
        json: async () => ({
          campaigns: [
            {
              id: 'ABCD1234',
              title: 'Offre de nuit',
              mediaType: 'image',
              mediaUrl: 'https://cdn.exemple.org/visuel.jpg',
              durationSeconds: 9,
            },
          ],
        }),
      };
    }) as never;

    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    const service = await getCampaignService();
    expect(service.kind).toBe('remote');
    expect((await service.listCampaigns())[0]?.id).toBe('ABCD1234');
    expect(fetched).toBe(1);

    // Instance mémoïsée : le cache de 30 s évite de rappeler le serveur.
    const again = await getCampaignService();
    expect(again).toBe(service);
    await again.listCampaigns();
    expect(fetched).toBe(1);

    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('reconstruit une instance après réinitialisation (changement de base URL)', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    const first = await getCampaignService();
    resetRegistryProvider();
    await setApiConfig({ baseUrl: 'https://api.exemple.org', enabled: true });
    const second = await getCampaignService();
    expect(second).not.toBe(first);
    expect(second.kind).toBe('remote');
  });

  it('revient au registre local quand la synchronisation est coupée', async () => {
    await setApiConfig({ baseUrl: 'http://localhost:4000', enabled: true });
    expect((await getCampaignService()).kind).toBe('remote');
    await setApiConfig({ baseUrl: '', enabled: false });
    resetRegistryProvider();
    expect((await getCampaignService()).kind).toBe('local');
  });
});
