/**
 * Écran principal : scanner QR plein écran.
 * - caméra arrière réelle via CameraView (expo-camera SDK 57) ;
 * - un seul scan traité à la fois + cooldown anti-re-scan du même code ;
 * - aucune navigation externe : un QR valide ouvre l'écran Advertisement,
 *   tout autre contenu affiche une erreur lisible.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraStatusPill, type CameraStatusLevel } from '../components/CameraStatusPill';
import { FlashIcon, InfoIcon } from '../components/Icons';
import { PermissionDeniedView, PermissionRequestView } from '../components/PermissionViews';
import { ScannerFrame } from '../components/ScannerFrame';
import { ToastMessage, type ToastTone } from '../components/ToastMessage';
import { useAppCameraPermission } from '../hooks/useCameraPermission';
import type { RootStackParamList } from '../navigation/types';
import { canAcceptScan, QR_ERROR_MESSAGES, resolveQrCode } from '../services/qrCodeService';
import { colors, radius, typography } from '../theme';
import { buildAdvertisementParams } from '../utils/navigation';

type ScannerNavigation = NativeStackNavigationProp<RootStackParamList, 'Scanner'>;

const UNLOCK_DELAY_MS = 1400;
const THROTTLE_HINT = 'QR déjà lu il y a quelques secondes : patientez ou scannez un autre code.';

export function ScannerScreen() {
  const navigation = useNavigation<ScannerNavigation>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const permission = useAppCameraPermission();

  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [scanningActive, setScanningActive] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: ToastTone } | null>(null);

  const scanningAllowedRef = useRef(true);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const mountedRef = useRef(true);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'error') => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (!mountedRef.current) return;
    setNotice({ message, tone });
    noticeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setNotice(null);
    }, 2800);
  }, []);

  const scheduleUnlock = useCallback(() => {
    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = setTimeout(() => {
      if (mountedRef.current) scanningAllowedRef.current = true;
    }, UNLOCK_DELAY_MS);
  }, []);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (!scanningAllowedRef.current) return;
      const value = typeof result?.data === 'string' ? result.data.trim() : '';

      const last = lastScanRef.current;
      if (
        !canAcceptScan({ value, lastValue: last?.value ?? null, lastAt: last?.at ?? null, inFlight: true })
      ) {
        // Un scan est déjà en cours : ignoré silencieusement (comportement voulu).
        return;
      }
      if (!canAcceptScan({ value, lastValue: last?.value ?? null, lastAt: last?.at ?? null, inFlight: false })) {
        showToast(THROTTLE_HINT, 'info');
        return;
      }

      scanningAllowedRef.current = false;
      lastScanRef.current = { value, at: Date.now() };
      setResolving(true);

      try {
        if (value.length === 0) {
          showToast(QR_ERROR_MESSAGES.EMPTY_INPUT);
        } else {
          const resolution = await resolveQrCode(value);
          if (!mountedRef.current) return;
          if (resolution.ok) {
            // Aucune ouverture de lien externe : le média est rendu dans l'app.
            navigation.navigate('Advertisement', buildAdvertisementParams(
              resolution.ad.campaignId,
              value,
              resolution.ad.durationSeconds
            ));
            return; // le scan reste verrouillé tant que l'écran pub est ouvert
          }
          showToast(resolution.message);
        }
      } catch {
        if (mountedRef.current) showToast('Erreur inattendue pendant la lecture du QR code.');
      } finally {
        if (mountedRef.current) setResolving(false);
        scheduleUnlock();
      }
    },
    [navigation, scheduleUnlock, showToast]
  );

  // À chaque retour sur le scanner (après la pub) : réarmement complet.
  useFocusEffect(
    useCallback(() => {
      scanningAllowedRef.current = true;
      lastScanRef.current = null;
      setNotice(null);
      setResolving(false);
      setTorchOn(false);
      return () => {
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      };
    }, [])
  );

  // Arrière-plan pendant un scan : on déverrouille au retour sans bloquer l'appareil.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active' && mountedRef.current) {
        setResolving(false);
        scheduleUnlock();
      }
    });
    return () => subscription.remove();
  }, [scheduleUnlock]);

  const openAppSettings = useCallback(() => {
    if (Platform.OS !== 'android') return;
    void Linking.openSettings().catch(() => {
      showToast('Réglages inaccessibles sur cet appareil.');
    });
  }, [showToast]);

  const cameraStatus: { level: CameraStatusLevel; label: string } = cameraError
    ? { level: 'error', label: 'Caméra : erreur matériel' }
    : !permission.granted
      ? { level: 'error', label: 'Caméra : accès manquant' }
      : !isFocused
        ? { level: 'working', label: 'Caméra : en pause' }
        : cameraReady
          ? { level: 'ready', label: 'Caméra : prête' }
          : { level: 'working', label: 'Caméra : initialisation…' };

  const onMountError = useCallback((event?: { message?: string }) => {
    setCameraReady(false);
    setCameraError(event?.message ?? 'La caméra n’a pas pu démarrer sur cet appareil.');
  }, []);

  const previewMounted = permission.granted && isFocused;

  return (
    <View style={styles.screen} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setFrame({
          width: Math.round(Math.min(width * 0.78, height * 0.52)),
          height: Math.round(Math.min(height * 0.38, width * 0.78)),
        });
      }}>
        {previewMounted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={resolving ? undefined : handleBarcodeScanned}
            onCameraReady={() => {
              setCameraReady(true);
              setCameraError(null);
              setScanningActive(true);
            }}
            onMountError={onMountError}
          />
        ) : null}

        {/* Fond de repli non noir pur quand la caméra n'affiche rien */}
        {!previewMounted || !cameraReady ? <View style={styles.previewFallback} /> : null}

        {frame ? (
          <View style={styles.frameWrapper}>
            <ScannerFrame
              width={frame.width}
              height={frame.height}
              scanning={previewMounted && !resolving && scanningActive && cameraReady}
              highlight={resolving}
            />
          </View>
        ) : null}
      </View>

      {/* En-tête */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appTitle}>QRSCANNER</Text>
            <Text style={styles.appSubtitle}>Lecteur de campagnes publicitaires</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torchOn ? 'Éteindre la lampe torche' : 'Allumer la lampe torche'}
              onPress={() => {
                if (!permission.granted) {
                  showToast('Autorisez d’abord la caméra pour utiliser la torche.', 'info');
                  return;
                }
                setTorchOn((v) => !v);
              }}
              hitSlop={10}
              style={({ pressed }) => [
                styles.iconButton,
                torchOn && styles.iconButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <FlashIcon color={torchOn ? colors.background : colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Informations sur l’application"
              onPress={() => navigation.navigate('About')}
              hitSlop={10}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <InfoIcon color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bandeau d'erreur */}
      {notice ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <ToastMessage message={notice.message} tone={notice.tone} onDismiss={() => setNotice(null)} />
        </View>
      ) : null}

      {/* Pied : consigne + état caméra */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <Text style={styles.instruction}>Scannez un QR code pour découvrir la publicité</Text>
        <CameraStatusPill level={cameraStatus.level} label={cameraStatus.label} />
        {cameraError ? <Text style={styles.errorDetail}>{cameraError}</Text> : null}
        {resolving ? <Text style={styles.resolving}>Recherche de la campagne associée…</Text> : null}
      </View>

      {/* Écrans d'autorisation (au-dessus de tout) */}
      {!permission.granted ? (
        <View style={styles.permissionOverlay}>
          {permission.state === 'denied' ? (
            <PermissionDeniedView
              platform={Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other'}
              onRetry={() => {
                void permission.request();
                setCameraError(null);
              }}
              onOpenSettings={openAppSettings}
            />
          ) : (
            <PermissionRequestView
              requesting={permission.requesting}
              notice={permission.state === 'unknown' ? 'Vérification des autorisations…' : undefined}
              onRequest={() => {
                void permission.request();
              }}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  previewFallback: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface },
  frameWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  appTitle: { ...typography.title, fontSize: 21 },
  appSubtitle: { ...typography.subtitle, fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.75 },
  toastWrap: { position: 'absolute', top: 110 + 34, left: 0, right: 0, alignItems: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  instruction: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: colors.overlay,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  errorDetail: { color: colors.danger, fontSize: 12.5, textAlign: 'center' },
  resolving: { color: colors.success, fontSize: 12.5 },
  permissionOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background },
});
