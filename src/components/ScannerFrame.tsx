/**
 * Cadre de scan avec coins lumineux et ligne de balayage animée.
 * Composant purement visuel (pointerEvents="none"), superposé à la caméra.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

interface ScannerFrameProps {
  /** Largeur du cadre en px. */
  width: number;
  /** Hauteur du cadre en px. */
  height: number;
  /** L'animation de balayage est active uniquement pendant le scan. */
  scanning: boolean;
  /** Couleur des coins (vert quand un scan est en cours de traitement). */
  highlight?: boolean;
  style?: StyleProp<ViewStyle>;
}

const CORNER_RATIO = 0.18;
const CORNER_THICKNESS = 5;

export function ScannerFrame({ width, height, scanning, highlight = false, style }: ScannerFrameProps) {
  const linePosition = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!scanning) {
      linePosition.stopAnimation();
      linePosition.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(linePosition, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(linePosition, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, linePosition]);

  useEffect(() => {
    if (!highlight) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 320, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 320, useNativeDriver: false }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [highlight, pulse]);

  const corner = Math.max(28, Math.min(width, height) * CORNER_RATIO);
  const lineColor = highlight ? colors.success : colors.primary;

  const lineTranslate = linePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [CORNER_THICKNESS, Math.max(CORNER_THICKNESS, height - CORNER_THICKNESS)],
  });

  const cornerOpacity = highlight ? pulse : 1;

  return (
    <View pointerEvents="none" style={[styles.root, { width, height }, style]} accessibilityElementsHidden>
      <Animated.View style={[styles.corner, styles.cornerTopLeft, { borderColor: lineColor, width: corner, height: corner, opacity: cornerOpacity }]} />
      <Animated.View style={[styles.corner, styles.cornerTopRight, { borderColor: lineColor, width: corner, height: corner, opacity: cornerOpacity }]} />
      <Animated.View style={[styles.corner, styles.cornerBottomLeft, { borderColor: lineColor, width: corner, height: corner, opacity: cornerOpacity }]} />
      <Animated.View style={[styles.corner, styles.cornerBottomRight, { borderColor: lineColor, width: corner, height: corner, opacity: cornerOpacity }]} />
      {scanning ? (
        <Animated.View
          style={[
            styles.scanLine,
            { width: width - corner * 0.8, transform: [{ translateY: lineTranslate }] },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderRadius: 6,
  },
  cornerTopLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTopRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{ scaleX: -1 }] },
  cornerBottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, transform: [{ scaleY: -1 }] },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    transform: [{ scale: -1 }],
  },
  scanLine: {
    position: 'absolute',
    left: '10%',
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
