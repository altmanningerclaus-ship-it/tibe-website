import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { getSetting } from '../db/repo';
import { useDataVersion } from '../lib/events';
import { useTheme } from '../theme';
import { Button } from './ui';

export const LOCK_SETTING = 'app_lock';
/** Nach so vielen Sekunden im Hintergrund wird wieder gesperrt. */
const RELOCK_AFTER_MS = 60_000;

/**
 * Optionale App-Sperre mit Face ID / Touch ID / Fingerabdruck (Geräte-PIN als Ausweich).
 */
export function LockGate({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const version = useDataVersion();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundSince = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kontaktkarte entsperren',
        cancelLabel: 'Abbrechen',
        fallbackLabel: 'Code eingeben',
        disableDeviceFallback: false,
      });
      if (res.success) setUnlocked(true);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const firstLoad = useRef(true);
  useEffect(() => {
    getSetting(db, LOCK_SETTING).then((v) => {
      const on = v === '1';
      if (firstLoad.current) {
        firstLoad.current = false;
        setEnabled(on);
        if (on) unlock(); // beim App-Start direkt nach Biometrie fragen
        return;
      }
      // Wird die Sperre während der Nutzung eingeschaltet, ist man bereits authentifiziert.
      if (on) setUnlocked(true);
      setEnabled(on);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundSince.current = Date.now();
      if (s === 'active' && backgroundSince.current) {
        const away = Date.now() - backgroundSince.current;
        backgroundSince.current = null;
        if (away > RELOCK_AFTER_MS) setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  if (enabled === null) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (!enabled || unlocked) return <>{children}</>;

  return (
    <View style={[styles.lock, { backgroundColor: t.bg }]}>
      <Ionicons name="lock-closed" size={64} color={t.primary} />
      <Text style={[styles.title, { color: t.text }]}>Kontaktkarte ist gesperrt</Text>
      <Button title="Entsperren" icon="finger-print" onPress={unlock} loading={busy} style={{ minWidth: 200 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  title: { fontSize: 20, fontWeight: '600' },
});
