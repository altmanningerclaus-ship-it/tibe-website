import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text } from 'react-native';

import { LOCK_SETTING } from '../../components/LockGate';
import { Card, ListRow, SectionTitle } from '../../components/ui';
import { geoStats, getSetting, retryFailedGeocodes, setSetting } from '../../db/repo';
import { useContacts } from '../../hooks/data';
import { emitDataChanged, useDataVersion } from '../../lib/events';
import { useTheme } from '../../theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const version = useDataVersion();
  const { contacts } = useContacts();
  const [lock, setLock] = useState(false);
  const [geo, setGeo] = useState<Record<string, number>>({});

  useEffect(() => {
    getSetting(db, LOCK_SETTING).then((v) => setLock(v === '1'));
    geoStats(db).then((rows) => setGeo(Object.fromEntries(rows.map((r) => [r.geo_status, r.n]))));
  }, [db, version]);

  const toggleLock = async (on: boolean) => {
    if (on) {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) {
        Alert.alert('Nicht verfügbar', 'Auf diesem Gerät ist kein Face ID / Fingerabdruck eingerichtet. Es wird der Geräte-Code verwendet.');
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'App-Sperre aktivieren' });
      if (!res.success) return;
    }
    await setSetting(db, LOCK_SETTING, on ? '1' : '0');
    setLock(on);
    emitDataChanged();
  };

  const failed = geo.failed ?? 0;
  const pending = geo.pending ?? 0;
  const located = (geo.ok ?? 0) + (geo.manual ?? 0);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionTitle>Daten</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow icon="pricetags-outline" title="Kategorien verwalten" onPress={() => router.push('/kategorien')} />
        <ListRow
          icon="people-outline"
          title="Aus Adressbuch importieren / neu abgleichen"
          onPress={() => router.push('/adressbuch')}
        />
        <ListRow icon="person-add-outline" title="Kontakt manuell anlegen" onPress={() => router.push('/kontakt/bearbeiten')} />
        <ListRow icon="archive-outline" title="Datensicherung (Export / Import)" onPress={() => router.push('/sicherung')} />
      </Card>

      <SectionTitle>Standorte</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="location-outline"
          title={`${located} von ${contacts.length} auf der Karte`}
          subtitle={[pending ? `${pending} werden gesucht` : '', failed ? `${failed} Adresse(n) nicht gefunden` : '', geo.none ? `${geo.none} ohne Adresse` : '']
            .filter(Boolean)
            .join(' · ') || undefined}
        />
        {failed > 0 && (
          <ListRow
            icon="refresh"
            title="Nicht gefundene Adressen erneut suchen"
            onPress={async () => {
              const n = await retryFailedGeocodes(db);
              Alert.alert('Wird erneut versucht', `${n} Adresse(n) werden im Hintergrund gesucht.`);
            }}
          />
        )}
      </Card>

      <SectionTitle>Datenschutz</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="finger-print"
          title="App-Sperre (Face ID / Fingerabdruck)"
          subtitle="Nach 1 Minute im Hintergrund wird erneut gesperrt."
          right={<Switch value={lock} onValueChange={toggleLock} />}
        />
      </Card>
      <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
        Alle Daten bleiben lokal auf diesem Gerät – kein Server, keine Cloud, kein Tracking. Netzwerkzugriffe gibt es nur
        für Kartenkacheln (Apple/Google Maps) und die Adress-Suche des Betriebssystems. Die Texterkennung läuft auf dem Gerät.
      </Text>
    </ScrollView>
  );
}
