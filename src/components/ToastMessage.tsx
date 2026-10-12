/**
 * Bandeau d'erreur éphémère du scanner (QR inconnu, campagne inactive…).
 * Non bloquant : il ne masque pas l'aperçu caméra.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export type ToastTone = 'error' | 'info' | 'success';

interface ToastMessageProps {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  /** Durée d'affichage en ms (0 = persistant jusqu'à onDismiss manuel). */
  durationMs?: number;
}

const TONE_COLORS: Record<ToastTone, string> = {
  error: colors.danger,
  info: colors.primary,
  success: colors.success,
};

export function ToastMessage({ message, tone = 'error', onDismiss, durationMs = 2600 }: ToastMessageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (durationMs <= 0) return;
    const timer = setTimeout(() => dismissRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity, borderColor: TONE_COLORS[tone] }]} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: TONE_COLORS[tone] }]} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    maxWidth: '92%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.overlay,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.text, fontSize: 14, lineHeight: 19 },
});
