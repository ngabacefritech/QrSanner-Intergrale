/**
 * Pastille d'état de la caméra (prête / initialisation / erreur / refusée).
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export type CameraStatusLevel = 'ready' | 'working' | 'error';

interface CameraStatusPillProps {
  level: CameraStatusLevel;
  label: string;
}

const DOT_COLORS: Record<CameraStatusLevel, string> = {
  ready: colors.success,
  working: colors.primary,
  error: colors.danger,
};

export function CameraStatusPill({ level, label }: CameraStatusPillProps) {
  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={`État caméra : ${label}`}>
      {level === 'working' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={[styles.dot, { backgroundColor: DOT_COLORS[level] }]} />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: colors.textMuted, fontSize: 12.5 },
});
