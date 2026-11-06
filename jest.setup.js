/**
 * Configuration d'environnement de test : les modules natifs (caméra, vidéo,
 * barre de navigation) sont mockés au niveau le plus fin possible pour que les
 * écrans puissent être rendus dans Jest sans couche native.
 * NOTE : les variables utilisées dans un factory jest.mock() doivent être
 * préfixées par « mock » (contrainte de babel-plugin-jest-hoist).
 */
const React = require('react');
const { View } = require('react-native');

const mockMakeSubscription = () => ({ remove: jest.fn() });
const mockMakePlayer = () => ({
  play: jest.fn(),
  pause: jest.fn(),
  addListener: jest.fn(() => mockMakeSubscription()),
  muted: false,
  loop: false,
  current: 0,
  duration: 0,
});
const mockReact = React;
const mockView = View;

jest.mock('expo-camera', () => {
  const CameraView = mockReact.forwardRef((props, ref) =>
    mockReact.createElement(mockView, { ...props, ref, testID: 'camera-view' })
  );
  return {
    CameraView,
    useCameraPermissions: jest.fn(() => [
      { granted: true, canAskAgain: false, status: 'granted' },
      jest.fn(async () => ({ granted: true, canAskAgain: false, status: 'granted' })),
    ]),
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  };
});

jest.mock('expo-video', () => {
  const VideoView = mockReact.forwardRef((props, ref) =>
    mockReact.createElement(mockView, { ...props, ref, testID: 'video-view' })
  );
  return {
    VideoView,
    createVideoPlayer: jest.fn(() => mockMakePlayer()),
    useVideoPlayer: jest.fn(() => mockMakePlayer()),
    isPictureInPictureSupported: jest.fn(() => false),
  };
});

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: {
    setHidden: jest.fn(),
    setStyle: jest.fn(),
  },
}));

// Silence les avertissements natifs non pertinents dans jsdom/node.
jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0', sdkVersion: '57.0.0' },
  nativeAppVersion: '1.0.0',
}));

// AsyncStorage en mémoire (mock officiel : @react-native-async-storage/async-storage/jest/async-storage)
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
      setItem: jest.fn(async (k, v) => { store.set(k, v); }),
      removeItem: jest.fn(async (k) => { store.delete(k); }),
      clear: jest.fn(async () => store.clear()),
      __store: store,
    },
  };
});
