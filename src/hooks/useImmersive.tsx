/**
 * Mode immersif pour l'écran publicitaire :
 * - barre d'état masquée via `expo-status-bar` (toutes plateformes) ;
 * - sur Android, barre de navigation masquée via `expo-navigation-bar`.
 * `applyImmersive` est une fonction pure exportée : testable sans native,
 * et le hook n'appelle le module natif que si le test/la plateforme le demande.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';

export interface ImmersiveController {
  immersive: boolean;
  setImmersive: (enabled: boolean) => void;
  statusBar: React.ReactElement | null;
}

export interface ImmersiveEffects {
  hideStatusBar: boolean;
  hideAndroidNavigationBar: boolean;
}

/** Décide quelles API natives appeler selon la plateforme (logique pure). */
export function applyImmersive(enabled: boolean, platform: string = Platform.OS): ImmersiveEffects {
  return {
    hideStatusBar: true,
    hideAndroidNavigationBar: platform === 'android',
  };
}

function setNativeImmersive(enabled: boolean): void {
  try {
    // expo-status-bar pilote déjà la barre d'état via <StatusBar hidden> ;
    // on applique aussi l'API imperative pour le cas où la vue est démontée vite.
    RNStatusBar.setHidden(enabled, enabled ? 'fade' : 'slide');
  } catch {
    /* non critique */
  }
  if (applyImmersive(enabled).hideAndroidNavigationBar) {
    try {
      NavigationBar.setHidden(enabled);
    } catch {
      /* anciens devices / unsupported : sans impact */
    }
  }
}

export function useImmersiveScreen(active: boolean): ImmersiveController {
  const [immersive, setImmersiveState] = useState(false);
  const mountedRef = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;

  const setImmersive = useCallback((enabled: boolean) => {
    const next = activeRef.current && enabled;
    if (mountedRef.current) setImmersiveState(next);
    setNativeImmersive(next);
  }, []);

  // Perte de focus (retour arrière, écran superposé) → sortie immédiate.
  useEffect(() => {
    if (!active) setImmersive(false);
  }, [active, setImmersive]);

  // Démontage → restauration garantie (jamais de setState après démontage).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setNativeImmersive(false);
    };
  }, []);

  return useMemo(
    () => ({
      immersive,
      setImmersive,
      statusBar: <StatusBar style={immersive ? 'light' : 'auto'} hidden={immersive} animated />,
    }),
    [immersive, setImmersive]
  );
}
