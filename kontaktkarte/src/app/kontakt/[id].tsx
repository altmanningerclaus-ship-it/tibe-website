import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Empty, IconButton, SectionTitle } from '../../components/ui';
import { deleteContact } from '../../db/repo';
import { useCategories, useContact } from '../../hooks/data';
import { call, mail, navigate, web } from '../../lib/actions';
import { addressQuery, displayName, formatDateDe } from '../../lib/contact-utils';
import { deletePhotoFile, photoUri } from '../../lib/photos';
import { textOn, useTheme } from '../../theme';

const GEO_TEXT: Record<string, string> = {
  ok: 'Auf der Karte',
  manual: 'Auf der Karte',
  pending: 'Standort wird gesucht …',
  failed: 'Ohne Standort – Adresse nicht gefunden',
  none: 'Ohne Standort – keine Adresse',
};

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const t = useTheme();
  const { contact: c, photos, loading } = useContact(id);
  const { byId } = useCategories();
  const [zoom, setZoom] = useState<string | null>(null);

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {!loading && <Empty icon="alert-circle-outline" title="Kontakt nicht gefunden" />}
      </View>
    );
  }

  const confirmDelete = () =>
    Alert.alert('Kontakt löschen?', `${displayName(c)} wird endgültig gelöscht (inkl. Kartenfotos).`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          const removed = await deleteContact(db, c.id);
          removed.forEach((p) => deletePhotoFile(p.file_name));
          router.back();
        },
      },
    ]);

  const phone = c.phone || c.mobile;
  const address = addressQuery(c);
  const rows: [string, string, (() => void) | undefined][] = [
    ['Telefon', c.phone, c.phone ? () => call(c.phone) : undefined],
    ['Mobil', c.mobile, c.mobile ? () => call(c.mobile) : undefined],
    ['E-Mail', c.email, c.email ? () => mail(c.email) : undefined],
    ['Website', c.website, c.website ? () => web(c.website) : undefined],
    ['Adresse', [c.street, `${c.postal_code} ${c.city}`.trim(), c.country].filter(Boolean).join('\n'), undefined],
    ['Kennengelernt am', formatDateDe(c.met_on), undefined],
    ['Kennengelernt in', c.met_at, undefined],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: displayName(c),
          headerRight: () => (
            <Pressable onPress={() => router.push({ pathname: '/kontakt/bearbeiten', params: { id: c.id } })} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: t.primary, fontSize: 17 }}>Bearbeiten</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: t.text }]}>{displayName(c)}</Text>
          {!!c.position && <Text style={{ color: t.muted, fontSize: 16 }}>{c.position}</Text>}
          {!!c.company && (c.first_name || c.last_name) && <Text style={{ color: t.text, fontSize: 16 }}>{c.company}</Text>}
          <View style={styles.cats}>
            {c.category_ids.map((cid, i) => {
              const cat = byId.get(cid);
              if (!cat) return null;
              return (
                <View key={cid} style={[styles.badge, { backgroundColor: cat.color }]}>
                  {i === 0 && c.category_ids.length > 1 && <Ionicons name="star" size={11} color={textOn(cat.color)} />}
                  <Text style={{ color: textOn(cat.color), fontSize: 13, fontWeight: '600' }}>{cat.name}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Card style={styles.actions}>
          <IconButton icon="call" label="Anrufen" onPress={() => call(phone)} disabled={!phone} />
          <IconButton icon="mail" label="E-Mail" onPress={() => mail(c.email)} disabled={!c.email} />
          <IconButton icon="navigate" label="Navigation" onPress={() => navigate(c)} disabled={!address} />
          <IconButton icon="globe-outline" label="Website" onPress={() => web(c.website)} disabled={!c.website} />
        </Card>

        <Card>
          {rows
            .filter(([, v]) => !!v)
            .map(([label, value, onPress]) => (
              <Pressable key={label} onPress={onPress} disabled={!onPress} style={[styles.row, { borderBottomColor: t.border }]}>
                <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
                <Text style={[styles.value, { color: onPress ? t.primary : t.text }]} selectable>
                  {value}
                </Text>
              </Pressable>
            ))}
          <View style={styles.geo}>
            <Ionicons
              name={c.geo_status === 'ok' || c.geo_status === 'manual' ? 'location' : 'location-outline'}
              size={16}
              color={t.muted}
            />
            <Text style={{ color: t.muted, fontSize: 13 }}>{GEO_TEXT[c.geo_status]}</Text>
          </View>
        </Card>

        {!!c.note && (
          <>
            <SectionTitle>Notiz</SectionTitle>
            <Card>
              <Text style={{ color: t.text, fontSize: 15 }} selectable>
                {c.note}
              </Text>
            </Card>
          </>
        )}

        {photos.length > 0 && (
          <>
            <SectionTitle>Visitenkarte</SectionTitle>
            {photos.map((p) => (
              <Pressable key={p.id} onPress={() => setZoom(photoUri(p.file_name))}>
                <Image source={{ uri: photoUri(p.file_name) }} style={styles.photo} resizeMode="contain" />
                <Text style={{ color: t.muted, fontSize: 12, marginBottom: 12 }}>
                  {p.side === 'front' ? 'Vorderseite' : 'Rückseite'}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        <Button title="Kontakt löschen" icon="trash-outline" variant="ghost" onPress={confirmDelete} style={{ marginTop: 16 }} />
      </ScrollView>

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBg} onPress={() => setZoom(null)}>
          {zoom && <Image source={{ uri: zoom }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 16, gap: 2 },
  name: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  cats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 12, marginBottom: 2 },
  value: { fontSize: 16 },
  geo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  photo: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#0002' },
  zoomBg: { flex: 1, backgroundColor: '#000E', alignItems: 'center', justifyContent: 'center' },
});
