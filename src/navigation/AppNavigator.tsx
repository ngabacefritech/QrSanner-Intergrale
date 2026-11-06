/**
 * Stack de navigation native. Le scanner est l'écran initial ;
 * aucun en-tête système (les écrans gèrent leur propre chrome immersif).
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AboutScreen } from '../screens/AboutScreen';
import { AdvertisementScreen } from '../screens/AdvertisementScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      id="qrscanner-root"
      initialRouteName="Scanner"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#070B1A' },
        orientation: 'portrait',
      }}
    >
      <Stack.Screen name="Scanner" component={ScannerScreen} />
      <Stack.Screen
        name="Advertisement"
        component={AdvertisementScreen}
        options={{ gestureEnabled: false, animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="About" component={AboutScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
