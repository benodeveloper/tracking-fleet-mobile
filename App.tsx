import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { api, clearSession, loadSession, saveSession, type AuthSession, type DriverVehicle } from './src/api/client';
import { API_BASE_URL } from './src/config';

type TrackState = { active: boolean; lastSent?: string; count: number; error?: string; coords?: string };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [username, setUsername] = useState('driver');
  const [password, setPassword] = useState('driver123');
  const [busy, setBusy] = useState(false);
  const [track, setTrack] = useState<TrackState>({ active: false, count: 0 });
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSession();
        if (s?.token) {
          setSession(s);
          try { setVehicle(await api.myVehicle()); } catch {}
        }
      } finally { setBooting(false); }
    })();
    return () => { watchRef.current?.remove(); };
  }, []);

  async function login() {
    setBusy(true);
    try {
      const s = await api.login(username.trim(), password);
      await saveSession(s);
      setSession(s);
      try { setVehicle(await api.myVehicle()); } catch (e: any) { Alert.alert('Vehicle', e.message || 'No assigned vehicle'); }
    } catch (e: any) {
      Alert.alert('Login failed', e.message || 'Unable to sign in');
    } finally { setBusy(false); }
  }

  async function logout() {
    watchRef.current?.remove(); watchRef.current = null;
    await clearSession();
    setSession(null); setVehicle(null); setTrack({ active: false, count: 0 });
  }

  async function startTracking() {
    if (!session) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Location permission is needed to track your vehicle.');
      return;
    }
    watchRef.current?.remove();
    setTrack({ active: true, count: 0, error: undefined });
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 15 },
      async (pos) => {
        const payload = {
          latitude: Number(pos.coords.latitude.toFixed(7)),
          longitude: Number(pos.coords.longitude.toFixed(7)),
          speedKph: pos.coords.speed != null && pos.coords.speed >= 0 ? Number((pos.coords.speed * 3.6).toFixed(2)) : null,
          heading: pos.coords.heading != null && pos.coords.heading >= 0 ? Number(pos.coords.heading.toFixed(2)) : null,
          accuracyMeters: pos.coords.accuracy != null ? Number(pos.coords.accuracy.toFixed(2)) : null,
          recordedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        try {
          await api.reportLocation(payload);
          setTrack((t) => ({ ...t, active: true, count: t.count + 1, error: undefined, lastSent: payload.recordedAt, coords: `${payload.latitude}, ${payload.longitude}` }));
        } catch (e: any) {
          setTrack((t) => ({ ...t, error: e.message || 'Failed to send location' }));
        }
      },
    );
  }

  function stopTracking() {
    watchRef.current?.remove(); watchRef.current = null;
    setTrack((t) => ({ ...t, active: false }));
  }

  if (booting) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color="#2dd4bf" /><Text style={styles.muted}>Loading…</Text></SafeAreaView>;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.loginWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.kicker}>TRACKING FLEET</Text>
            <Text style={styles.title}>Driver Device</Text>
            <Text style={styles.muted}>Sign in to report your vehicle location for live tracking.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>API</Text>
            <Text style={styles.apiUrl}>{API_BASE_URL}</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} autoCapitalize="none" value={username} onChangeText={setUsername} />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
            <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={login} disabled={busy}>
              <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
            </Pressable>
            <Text style={styles.hint}>Local dev: driver / driver123</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>DRIVER</Text>
            <Text style={styles.titleSm}>{session.displayName}</Text>
          </View>
          <Pressable style={styles.ghost} onPress={logout}><Text style={styles.ghostText}>Sign out</Text></Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Assigned vehicle</Text>
          {vehicle ? (
            <>
              <Text style={styles.vehicleMain}>{vehicle.registrationNumber}</Text>
              <Text style={styles.muted}>{vehicle.brand} {vehicle.model} · {vehicle.status}</Text>
              <Text style={styles.meta}>ID: {vehicle.id}</Text>
            </>
          ) : (
            <Text style={styles.warn}>No vehicle assigned. Ask an admin to assign one.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Live tracking</Text>
          <Text style={styles.muted}>Reports GPS to <Text style={styles.meta}>POST /api/v1/driver/me/location</Text>. Backend broadcasts updates to WebSocket subscribers.</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, track.active ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.statusText}>{track.active ? 'Tracking active' : 'Tracking stopped'}</Text>
          </View>
          {track.coords ? <Text style={styles.meta}>Last: {track.coords}</Text> : null}
          {track.lastSent ? <Text style={styles.meta}>Sent: {track.lastSent}</Text> : null}
          <Text style={styles.meta}>Reports sent: {track.count}</Text>
          {track.error ? <Text style={styles.warn}>{track.error}</Text> : null}
          {!track.active ? (
            <Pressable style={styles.button} onPress={startTracking}><Text style={styles.buttonText}>Start tracking</Text></Pressable>
          ) : (
            <Pressable style={[styles.button, styles.buttonDanger]} onPress={stopTracking}><Text style={styles.buttonText}>Stop tracking</Text></Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  center: { flex: 1, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginWrap: { padding: 20, paddingTop: 48 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { marginBottom: 18 },
  kicker: { color: '#2dd4bf', fontWeight: '700', fontSize: 12, letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 34, fontWeight: '800', marginTop: 4 },
  titleSm: { color: '#f8fafc', fontSize: 24, fontWeight: '800' },
  muted: { color: '#94a3b8', marginTop: 4, lineHeight: 20 },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1f2937', gap: 8 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginTop: 4 },
  apiUrl: { color: '#64748b', fontSize: 12 },
  input: { backgroundColor: '#0b1220', color: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#243244' },
  button: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6 },
  buttonDanger: { backgroundColor: '#b91c1c' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800' },
  ghost: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  ghostText: { color: '#e2e8f0', fontWeight: '700' },
  hint: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  sectionTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '800' },
  vehicleMain: { color: '#2dd4bf', fontSize: 28, fontWeight: '800' },
  meta: { color: '#64748b', fontSize: 12 },
  warn: { color: '#fbbf24', fontSize: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#22c55e' },
  dotOff: { backgroundColor: '#475569' },
  statusText: { color: '#e2e8f0', fontWeight: '700' },
});
