/**
 * Indicateur de chargement discret (recherche de campagne, chargement média).
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

interface LoadingIndicatorProps {
  label?: string;
  visible?: boolean;
}

export function LoadingIndicator({ label = 'Chargement…', visible = true }: LoadingIndicatorProps) {
  if (!visible) return null;
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  label: { color: colors.text, fontSize: 13 },
});
