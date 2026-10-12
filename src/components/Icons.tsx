/**
 * Petites icônes vectorielles dessinées en View (aucune dépendance d'iconographie,
 * police système non requise, testable).
 */
import { StyleSheet, View } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
}

export function FlashIcon({ color, size = 22 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.flashBolt, { backgroundColor: color }]} />
      <View style={[styles.flashBase, { backgroundColor: color }]} />
    </View>
  );
}

export function InfoIcon({ color, size = 22 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.infoRing, { borderColor: color }]}>
        <View style={[styles.infoDot, { backgroundColor: color }]} />
        <View style={[styles.infoStem, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function CameraIcon({ color, size = 34 }: IconProps) {
  return (
    <View style={{ width: size, height: size * 0.78, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.cameraBody, { borderColor: color }]}>
        <View style={[styles.cameraLens, { borderColor: color }]} />
      </View>
      <View style={[styles.cameraBump, { backgroundColor: color }]} />
    </View>
  );
}

export function CloseIcon({ color, size = 20 }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.closeBar, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.closeBar, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flashBolt: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 12, borderTopWidth: 0, borderColor: 'transparent', borderRightColor: 'transparent' },
  flashBase: { width: 6, height: 4, borderRadius: 2, marginTop: 2 },
  infoRing: { width: '86%', height: '86%', borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  infoDot: { width: 3, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 1.5, marginTop: -1 },
  infoStem: { width: 3, height: '42%', borderRadius: 1.5 },
  cameraBody: { width: '86%', height: '78%', borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cameraLens: { width: 11, height: 11, borderRadius: 999, borderWidth: 2 },
  cameraBump: { position: 'absolute', top: 1, width: 10, height: 4, borderRadius: 2 },
  closeBar: { position: 'absolute', width: '80%', height: 2.5, borderRadius: 2 },
});
