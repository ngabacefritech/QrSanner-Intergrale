/**
 * Test d'intégration de l'écran publicitaire : chargement de la campagne,
 * compte à rebours jusqu'à 0, arrêt propre (pause vidéo + restauration
 * immersif) et retour automatique au scanner — exactement UNE fois.
 * Les modules natifs (video, navigation, nav bar) sont mockés
 * (camera/video/nav-bar : mocks globaux dans jest.setup.js).
 */
import { act, render, screen } from '@testing-library/react-native';
import { Image, Platform } from 'react-native';

jest.mock('../src/services/campaignService', () => {
  const record = {
    id: 'DEMO-VIDEO-001',
    title: 'Démo vidéo Expo',
    qrCodeValue: 'qrscanner://campaign/DEMO-VIDEO-001',
    mediaType: 'video',
    mediaSource: { kind: 'asset', assetKey: 11 },
    durationSeconds: 2,
    isActive: true,
    createdAt: '2026-10-01T09:30:00.000Z',
    description: 'démo',
    fallbackImage: { kind: 'asset', assetKey: 12 },
    allowEarlySkip: false,
    allowDirectUrlMedia: false,
  };
  return {
    campaignService: {
      listCampaigns: async () => [record],
      findById: async () => record,
      findByQrCodeValue: async () => record,
    },
  };
});

jest.mock('@react-navigation/native', () => {
  const mockState = { focused: true, goBackCalls: 0, popCalls: 0 };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  return {
    __mockState: mockState,
    useIsFocused: () => mockState.focused,
    useNavigation: () => ({
      goBack: () => {
        mockState.goBackCalls += 1;
      },
      pop: () => {
        mockState.popCalls += 1;
      },
      canGoBack: () => true,
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    }),
    useFocusEffect: (fn: () => (() => void) | undefined) => {
      React.useEffect(() => fn(), []);
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AdvertisementScreen } = require('../src/screens/AdvertisementScreen');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const navMock = jest.requireMock('@react-navigation/native');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockState = navMock.__mockState;

function makeProps(key: string, durationSeconds: number) {
  return {
    navigation: {
      goBack: () => {
        mockState.goBackCalls += 1;
      },
      pop: () => {
        mockState.popCalls += 1;
      },
      canGoBack: () => true,
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    route: {
      key,
      name: 'Advertisement',
      params: { campaignId: 'DEMO-VIDEO-001', qrValue: 'qrscanner://campaign/DEMO-VIDEO-001', durationSeconds, resolvedAt: new Date().toISOString() },
    },
  };
}

describe('AdvertisementScreen — retour automatique au scanner', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    // Le mode immersif Android masque la barre de navigation : on simule Android.
    (Platform as unknown as { OS: string }).OS = 'android';
    (Image as unknown as { resolveAssetSource: (k: unknown) => { uri: string } }).resolveAssetSource = (k: unknown) => ({
      uri: `file://asset-${String(k)}.mp4`,
    });
  });
  afterAll(() => {
    (Platform as unknown as { OS: string }).OS = 'ios';
    jest.useRealTimers();
  });
  beforeEach(() => {
    mockState.focused = true;
    mockState.goBackCalls = 0;
    mockState.popCalls = 0;
  });

  it('se termine proprement à zéro : goBack unique + restauration immersif', async () => {
    render(<AdvertisementScreen {...makeProps('ad', 2)} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(mockState.goBackCalls).toBe(1);
    expect(mockState.popCalls).toBe(0);
    const navBar = jest.requireMock('expo-navigation-bar') as { NavigationBar: { setHidden: jest.Mock } };
    expect(navBar.NavigationBar.setHidden).toHaveBeenLastCalledWith(false);
  });

  it('ne navigue jamais deux fois (fin + retour d’arrière-plan)', async () => {
    render(<AdvertisementScreen {...makeProps('ad2', 1)} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    // Un second rendu après fin ne doit rien déclencher de plus.
    mockState.focused = false;
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockState.goBackCalls).toBe(1);
  });

  it('affiche le titre de campagne et le compte à rebours initial', async () => {
    render(<AdvertisementScreen {...makeProps('ad3', 9)} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(screen.getByText('Démo vidéo Expo')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });
});
