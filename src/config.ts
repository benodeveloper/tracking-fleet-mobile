import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_BASE_URL in mobile/.env, e.g. http://192.168.1.10:8081
// Use your machine's LAN IP (not localhost) when testing with Expo Go on a device.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8081' : 'http://localhost:8081');

export const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
