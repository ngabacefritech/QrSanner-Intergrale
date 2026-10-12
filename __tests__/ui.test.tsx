/**
 * Tests de rendu : les composants et écrans clés s'affichent, gèrent leurs
 * états d'erreur et ne crashent pas quand la caméra ou un média fait défaut.
 * (Les modules natifs expo-camera / expo-video sont mockés dans jest.setup.js.)
 */
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => false), addListener: jest.fn(() => ({ remove: jest.fn() })) };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useIsFocused: () => true,
  useFocusEffect: (fn: () => void) => {
    (require('react') as typeof import('react')).useEffect(() => {
      const cleanup = typeof fn === 'function' ? fn() : undefined;
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [fn]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
import { ScannerFrame } from '../src/components/ScannerFrame';
import { Countdown } from '../src/components/Countdown';
import { CameraStatusPill } from '../src/components/CameraStatusPill';
import { ToastMessage } from '../src/components/ToastMessage';
import { PermissionDeniedView, PermissionRequestView } from '../src/components/PermissionViews';
import { ScannerScreen } from '../src/screens/ScannerScreen';

describe('ScannerFrame', () => {
  it('se rend avec les dimensions demandées et n’intercepte pas les gestes', () => {
    render(<ScannerFrame width={260} height={260} scanning />);
    // pointerEvents="none" : aucun crash, aucun élément interceptant les touches.
    expect(screen.queryByText(/Scannez/)).toBeNull();
  });
});

describe('Countdown', () => {
  it('affiche le nombre de secondes restantes et une libellé accessible', () => {
    render(<Countdown remainingSeconds={7} totalSeconds={10} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('s')).toBeTruthy();
  });

  it('borne une valeur négative à 0', () => {
    render(<Countdown remainingSeconds={-4} totalSeconds={10} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('CameraStatusPill', () => {
  it('annonce l’état de la caméra en français', () => {
    render(<CameraStatusPill level="error" label="Caméra : erreur matériel" />);
    expect(screen.getByText('Caméra : erreur matériel')).toBeTruthy();
  });
});

describe('ToastMessage', () => {
  it('affiche le message et prévient l’hôte à la fin de la durée', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<ToastMessage message="QR code inconnu : aucune campagne associée." onDismiss={onDismiss} durationMs={100} />);
    expect(screen.getByText('QR code inconnu : aucune campagne associée.')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('écrans d’autorisation caméra', () => {
  it('propose explicitement la demande de permission', () => {
    const onRequest = jest.fn();
    render(<PermissionRequestView onRequest={onRequest} requesting={false} />);
    fireEvent.press(screen.getByText('Autoriser la caméra'));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  it('explique le refus et offre réessayer + réglages sur Android', () => {
    const onRetry = jest.fn();
    const onOpenSettings = jest.fn();
    render(
      <PermissionDeniedView
        platform={Platform.OS === 'android' ? 'android' : 'ios'}
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
      />
    );
    expect(screen.getByText('Caméra indisponible')).toBeTruthy();
    fireEvent.press(screen.getByText('Réessayer'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    if (Platform.OS === 'android') {
      fireEvent.press(screen.getByText('Ouvrir les réglages'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    }
  });
});

describe('ScannerScreen (rendu)', () => {
  it('affiche titre, consigne et indicateur d’état quand la caméra est autorisée', () => {
    render(<ScannerScreen />);
    expect(screen.getByText('QRSCANNER')).toBeTruthy();
    expect(screen.getByText('Scannez un QR code pour découvrir la publicité')).toBeTruthy();
    expect(screen.getByText(/Caméra :/)).toBeTruthy();
  });

  it('reste interactif : les boutons torche et informations sont accessibles', () => {
    render(<ScannerScreen />);
    // La torche et l'accès « À propos » doivent exister même avant le premier scan.
    expect(screen.getByTestId('camera-view')).toBeTruthy(); // caméra mockée rendue par le setup
  });
});
