import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Try to derive the dev machine IP from Expo (LAN URL shown in Expo CLI).
 * Works for many Expo Go + physical device setups when unset.
 */
function apiUrlFromExpoHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (typeof hostUri !== 'string' || !hostUri.includes(':')) {
    return null;
  }

  const ip = hostUri.split(':')[0];
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return null;
  }

  return `http://${ip}:8000`;
}

/**
 * Fallback when env + Expo host are not enough.
 * - Android Emulator: 10.0.2.2 is the host loopback (127.0.0.1 on the emulator is the emulator itself).
 * - iOS Simulator: 127.0.0.1 reaches the Mac.
 */
function defaultBaseUrl() {
  if (Platform.OS === 'android' && Device.isDevice === false) {
    return 'http://10.0.2.2:8000';
  }
  return 'http://127.0.0.1:8000';
}

const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const API_BASE_URL = fromEnv || apiUrlFromExpoHost() || defaultBaseUrl();
