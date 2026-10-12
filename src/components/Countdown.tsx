/**
 * Compte à rebours de fin de publicité : capsule translucide + barre
 * de progression (implémentation View pure, sans dépendance SVG).
 */
import { StyleSheet, Text, View } from 'react-native';
import { countdownProgress } from '../utils/countdown';
import { colors, radius } from '../theme';

interface CountdownProps {
  remainingSeconds: number;
  totalSeconds: number;
  /** Libellé affiché au-dessus du nombre (ex. « BIENTÔT DE RETOUR AU SCANNER »). */
  label?: string;
}

export function Countdown({ remainingSeconds, totalSeconds, label = 'Fin de la publicité' }: CountdownProps) {
  const progress = countdownProgress(remainingSeconds, totalSeconds);
  const clamped = Math.max(0, Math.floor(remainingSeconds));

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.label} accessibilityLabel={`${label} dans ${clamped} secondes`}>
        {label}
      </Text>
      <View style={styles.row}>
        <Text style={styles.count}>{clamped}</Text>
        <Text style={styles.unit}>s</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 168,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  label: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  count: { fontSize: 34, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, color: colors.primary, marginLeft: 4 },
  track: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});
