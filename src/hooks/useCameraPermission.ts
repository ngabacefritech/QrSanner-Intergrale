/**
 * Hook de permission caméra : état, demande, nouvelle demande.
 * Enveloppe `useCameraPermissions` de expo-camera (SDK 57).
 */
import { useCallback, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';

export type CameraPermissionState = 'unknown' | 'granted' | 'undetermined' | 'denied';

export function derivePermissionState(granted: boolean | null, canAskAgain: boolean): CameraPermissionState {
  if (granted === null) return 'unknown';
  if (granted) return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

export interface CameraPermissionResult {
  state: CameraPermissionState;
  granted: boolean;
  canAskAgain: boolean;
  /** Demande la permission (première demande ou nouvelle demande si possible). */
  request: () => Promise<void>;
  /** true pendant une demande en cours (pour désactiver les boutons). */
  requesting: boolean;
}

export function useAppCameraPermission(): CameraPermissionResult {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);

  const request = useCallback(async () => {
    if (!requestPermission) return;
    setRequesting(true);
    try {
      await requestPermission();
    } finally {
      setRequesting(false);
    }
  }, [requestPermission]);

  const granted = permission?.granted ?? null;
  const canAskAgain = permission?.canAskAgain ?? true;

  return {
    state: derivePermissionState(granted, canAskAgain),
    granted: granted === true,
    canAskAgain,
    request,
    requesting,
  };
}
