import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../components/ui';
import { parseCardText } from '../../lib/card-parser';
import { captureCard } from '../../lib/camera';
import { setDraft } from '../../lib/draft';
import { ocrAvailable, recognizeText } from '../../lib/ocr';
import { useTheme } from '../../theme';

type Side = 'front' | 'back';

export default function ScanScreen() {
  const t = useTheme();
  const [front, setFront] = useState<string>();
  const [back, setBack] = useState<string>();
  const [busy, setBusy] = useState(false);

  const take = async (side: Side, source: 'camera' | 'library') => {
    const uri = await captureCard(source);
    if (!uri) return;
    if (side === 'front') setFront(uri);
    else setBack(uri);
  };

  const proceed = async () => {
    if (!front) return;
    setBusy(true);
    try {
      const blocks = [...(await recognizeText(front)), ...(back ? await recognizeText(back) : [])];
      const fields = parseCardText(blocks);
      if (!blocks.length) {
        Alert.alert('Kein Text erkannt', 'Die Felder können manuell ausgefüllt werden.');
      }
      setDraft({ fields, frontUri: front, backUri: back, rawText: blocks.join('\n') });
      router.push({ pathname: '/kontakt/bearbeiten', params: { from: 'scan' } });
      setFront(undefined);
      setBack(undefined);
    } catch (e) {
      Alert.alert('Texterkennung fehlgeschlagen', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const renderSlot = (side: Side, uri?: string) => (
    <Card key={side} style={{ padding: 10 }}>
      <Text style={[styles.slotTitle, { color: t.text }]}>
        {side === 'front' ? 'Vorderseite' : 'Rückseite (optional)'}
      </Text>
      {uri ? (
        <Pressable onPress={() => take(side, 'camera')}>
          <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Tippen zum Neu-Aufnehmen</Text>
        </Pressable>
      ) : (
        <View style={styles.slotButtons}>
          <Button title="Fotografieren" icon="camera" onPress={() => take(side, 'camera')} style={{ flex: 1 }} variant={side === 'front' ? 'primary' : 'secondary'} />
          <Button title="Fotos" icon="images-outline" onPress={() => take(side, 'library')} variant="secondary" />
        </View>
      )}
    </Card>
  );

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hint}>
        <Ionicons name="card-outline" size={28} color={t.primary} />
        <Text style={{ color: t.muted, flex: 1 }}>
          Karte flach auf einen dunklen Untergrund legen, gut ausleuchten und formatfüllend fotografieren.
          Die Texterkennung läuft vollständig auf dem Handy.
        </Text>
      </View>

      {renderSlot('front', front)}
      {renderSlot('back', back)}

      {!ocrAvailable && (
        <Text style={{ color: t.danger, marginBottom: 8 }}>
          Texterkennung ist auf diesem Gerät nicht verfügbar – Felder bitte manuell ausfüllen.
        </Text>
      )}

      <Button title="Text erkennen & weiter" icon="sparkles-outline" onPress={proceed} disabled={!front} loading={busy} />
      <Button title="Ohne Karte manuell anlegen" variant="ghost" onPress={() => router.push('/kontakt/bearbeiten')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  slotTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  slotButtons: { flexDirection: 'row', gap: 8 },
  preview: { width: '100%', height: 180, borderRadius: 8 },
});
