/**
 * Écrans d'aide quand la caméra n'est pas disponible :
 * - demande de permission (avant refus) ;
 * - explication après refus avec bouton « Réessayer » et,
 *   sur Android, raccourci vers les réglages système.
 */
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { CameraIcon } from './Icons';
import { colors, radius, spacing, typography } from '../theme';

interface PermissionRequestViewProps {
  onRequest: () => void;
  requesting: boolean;
  /** Message complémentaire (ex. : refus précédent). */
  notice?: string;
}

export function PermissionRequestView({ onRequest, requesting, notice }: PermissionRequestViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <CameraIcon color={colors.primary} size={44} />
      </View>
      <Text style={styles.title}>Autorisation caméra requise</Text>
      <Text style={styles.body}>
        QRScanner utilise la caméra uniquement pour lire les QR codes des campagnes
        publicitaires. Aucune image n’est enregistrée ni envoyée.
      </Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Autoriser l’accès à la caméra"
        disabled={requesting}
        onPress={onRequest}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, requesting && styles.disabled]}
      >
        <Text style={styles.primaryButtonText}>{requesting ? 'Demande en cours…' : 'Autoriser la caméra'}</Text>
      </Pressable>
    </View>
  );
}

interface PermissionDeniedViewProps {
  platform: 'ios' | 'android' | 'other';
  onRetry: () => void;
  onOpenSettings?: () => void;
}

export function PermissionDeniedView({ platform, onRetry, onOpenSettings }: PermissionDeniedViewProps) {
  const guidance =
    platform === 'ios'
      ? 'Réglez l’accès dans Réglages → QRScanner → Caméra, puis revenez dans l’application.'
      : platform === 'android'
        ? 'Réglez l’accès dans Réglages → Applications → QRScanner → Autorisations → Caméra.'
        : 'Activez la caméra dans les paramètres de l’application, puis relancez QRScanner.';

  return (
    <View style={styles.container}>
      <View style={[styles.illustration, { borderColor: colors.danger }]}>
        <CameraIcon color={colors.danger} size={44} />
      </View>
      <Text style={styles.title}>Caméra indisponible</Text>
      <Text style={styles.body}>
        Vous avez refusé l’accès à la caméra, le scanner ne peut donc pas démarrer. Aucun scan
        n’est possible tant que cette autorisation manque.
      </Text>
      <Text style={styles.guidance}>{guidance}</Text>
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Réessayer</Text>
        </Pressable>
        {platform === 'android' && onOpenSettings ? (
          <Pressable accessibilityRole="button" onPress={onOpenSettings} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Ouvrir les réglages</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  illustration: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, fontSize: 22, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  notice: { ...typography.body, color: colors.warning, textAlign: 'center' },
  guidance: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  buttons: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  primaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    minWidth: 160,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#041018', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minWidth: 160,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
