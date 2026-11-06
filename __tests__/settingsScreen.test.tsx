/**
 * Écran « Connexion » : validation de l'URL, activation, test de l'API.
 * Les modules natifs (caméra/vidéo) sont déjà mockés dans jest.setup.js.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsScreen } from '../src/screens/SettingsScreen';
import { API_CONFIG_STORAGE_KEY } from '../src/services/apiConfig';
import { resetApiConfigCache } from '../src/services/apiConfig';

const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };

function renderScreen() {
  return render(
    <SettingsScreen
      navigation={navigation as never}
      route={{ key: 'Settings', name: 'Settings', params: undefined }}
    />
  );
}

/** Laisse la promise de chargement de la configuration se résoudre. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SettingsScreen', () => {
  beforeEach(async () => {
    resetApiConfigCache();
    await AsyncStorage.clear();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('affiche le registre local par défaut', async () => {
    renderScreen();
    await flush();
    expect(screen.getByText('Connexion')).toBeTruthy();
    expect(screen.getByText('Registre local (démonstration)')).toBeTruthy();
    expect(screen.getByText(/6 campagnes embarquées/)).toBeTruthy();
  });

  it('refuse une URL publique non sécurisée et désactive l’enregistrement', async () => {
    renderScreen();
    await flush();
    fireEvent.changeText(screen.getByTestId('api-url-input'), 'http://pub.exemple.org');
    expect(screen.getByText(/HTTP autorisé uniquement en local/)).toBeTruthy();
    // Aucune persistance possible tant que l'URL est refusée par la politique de sécurité.
    await act(async () => {
      fireEvent.press(screen.getByTestId('api-save'));
      await Promise.resolve();
    });
    expect(await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('enregistre une URL locale et active la synchronisation', async () => {
    renderScreen();
    await flush();
    fireEvent.changeText(screen.getByTestId('api-url-input'), 'http://localhost:4000/');

    await act(async () => {
      fireEvent.press(screen.getByTestId('api-save'));
      await Promise.resolve();
    });

    const stored = JSON.parse(String(await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY))) as Record<string, unknown>;
    expect(stored).toEqual({ baseUrl: 'http://localhost:4000', enabled: true });
    expect(screen.getByText('Registre distant (API)')).toBeTruthy();
    expect(screen.getByText(/Synchronisation active/)).toBeTruthy();
  });

  it('teste la joignabilité de l’API avant d’enregistrer', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ campaigns: [{ id: 'ABCD1234', title: 'X', mediaType: 'image', mediaUrl: 'https://cdn.a.org/i.jpg', durationSeconds: 8 }] }),
    }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock as never;

    renderScreen();
    await flush();
    fireEvent.changeText(screen.getByTestId('api-url-input'), 'https://api.exemple.org');
    await act(async () => {
      fireEvent.press(screen.getByTestId('api-test'));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.exemple.org/api/campaigns', expect.objectContaining({ method: 'GET' }));
    expect(screen.getByText(/API joignable — 1 campagne active/)).toBeTruthy();
    // Rien n'a été enregistré : le test est distinct de l'activation.
    expect(await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('coupe la synchronisation depuis l’interrupteur', async () => {
    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify({ baseUrl: 'https://api.exemple.org', enabled: true }));
    renderScreen();
    await flush();
    expect(screen.getByText('Registre distant (API)')).toBeTruthy();

    await act(async () => {
      fireEvent(screen.getByTestId('sync-switch'), 'onValueChange', false);
      await Promise.resolve();
    });
    expect(JSON.parse(String(await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY)))).toEqual({
      baseUrl: '',
      enabled: false,
    });
  });
});
