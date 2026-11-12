import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Button, Card, SectionTitle } from '../components/ui';
import { exportBackupZip, exportCsv, exportVCard, pickBackup, restoreBackup, type LoadedBackup, type RestoreMode } from '../lib/backup';
import { useTheme } from '../theme';

export default function BackupScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Fehler', String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const restore = (loaded: LoadedBackup, mode: RestoreMode) =>
    run('Wiederherstellen …', async () => {
      const r = await restoreBackup(db, loaded, mode, setBusy);
      Alert.alert(
        'Wiederherstellung abgeschlossen',
        mode === 'replace'
          ? `${r.added} Kontakte und ${r.photos} Fotos wiederhergestellt.`
          : `${r.added} neu, ${r.updated} aktualisiert, ${r.skipped} unverändert, ${r.photos} Fotos.`,
      );
    });

  const startImport = () =>
    run('Datei lesen …', async () => {
      const loaded = await pickBackup();
      if (!loaded) return;
      const { data } = loaded;
      Alert.alert(
        'Sicherung einspielen',
        `${loaded.name}\nvom ${new Date(data.exported_at).toLocaleString('de-AT')}\n${data.contacts.length} Kontakte, ${data.categories.length} Kategorien, ${data.photos.length} Fotos.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Zusammenführen', onPress: () => restore(loaded, 'merge') },
          {
            text: 'Alles ersetzen',
            style: 'destructive',
            onPress: () =>
              Alert.alert('Wirklich ersetzen?', 'Alle Kontakte, Kategorien und Fotos auf diesem Gerät werden durch die Sicherung ersetzt.', [
                { text: 'Abbrechen', style: 'cancel' },
                { text: 'Ersetzen', style: 'destructive', onPress: () => restore(loaded, 'replace') },
              ]),
          },
        ],
      );
    });

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <Text style={{ color: t.text, lineHeight: 21 }}>
          Alle Daten liegen ausschließlich auf diesem Handy. Bitte regelmäßig eine Sicherung erstellen und z. B. auf den
          Rechner, einen USB-Stick oder in einen Ordner deiner Wahl kopieren – über das Teilen-Menü des Systems.
        </Text>
      </Card>

      <SectionTitle>Exportieren</SectionTitle>
      <Button
        title="Vollständige Sicherung (ZIP)"
        icon="archive-outline"
        onPress={() => run('Sicherung erstellen …', () => exportBackupZip(db, setBusy))}
        disabled={!!busy}
      />
      <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>
        Enthält data.json (für die Wiederherstellung), alle Kartenfotos sowie kontakte.csv und kontakte.vcf.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Nur CSV" variant="secondary" onPress={() => run('CSV …', () => exportCsv(db))} disabled={!!busy} style={{ flex: 1 }} />
        <Button title="Nur vCard" variant="secondary" onPress={() => run('vCard …', () => exportVCard(db))} disabled={!!busy} style={{ flex: 1 }} />
      </View>

      <SectionTitle>Wiederherstellen</SectionTitle>
      <Button title="Sicherung einspielen …" icon="cloud-download-outline" variant="secondary" onPress={startImport} disabled={!!busy} />
      <Text style={{ color: t.muted, fontSize: 12 }}>
        „Zusammenführen“ ergänzt fehlende Kontakte und übernimmt neuere Stände. „Alles ersetzen“ stellt exakt den Stand der Sicherung her.
      </Text>

      {busy && <Text style={{ color: t.primary, marginTop: 16, textAlign: 'center' }}>{busy}</Text>}
    </ScrollView>
  );
}
