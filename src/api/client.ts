import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'tf_driver_token';
const SESSION_KEY = 'tf_driver_session';

export type AuthSession = {
  token: string | null;
  tokenType: string;
  expiresInSeconds: number;
  username: string;
  displayName: string;
  role: string;
  assignedVehicleId?: string | null;
};

export type DriverVehicle = {
  id: string;
  registrationNumber: string;
  brand: string;
  model: string;
  status: string;
};

export async function saveSession(session: AuthSession) {
  if (session.token) await AsyncStorage.setItem(TOKEN_KEY, session.token);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as AuthSession) : null;
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) await clearSession();
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return (data?.data ?? data) as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AuthSession>('/api/v1/auth/me'),
  myVehicle: () => request<DriverVehicle>('/api/v1/driver/me/vehicle'),
  reportLocation: (payload: {
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    heading?: number | null;
    accuracyMeters?: number | null;
    recordedAt: string;
  }) =>
    request('/api/v1/driver/me/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
