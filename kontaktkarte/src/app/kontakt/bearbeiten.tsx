import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryPicker } from '../../components/CategoryPicker';
import { DateField } from '../../components/DateField';
import { Button, Card, Field, SectionTitle } from '../../components/ui';
import { deletePhotoRow, getContact, listContacts, listPhotos, saveContact, upsertPhoto } from '../../db/repo';
import type { ContactFields, ContactPhoto } from '../../db/types';
import { EMPTY_FIELDS } from '../../db/types';
import { useCategories } from '../../hooks/data';
import { captureCard } from '../../lib/camera';
import { displayName, isDuplicate } from '../../lib/contact-utils';
import { clearDraft, peekDraft } from '../../lib/draft';
import { deletePhotoFile, photoUri, storePhoto } from '../../lib/photos';
import { useTheme } from '../../theme';

type Side = 'front' | 'back';

export default function EditContact() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const db = useSQLiteContext();
  const t = useTheme();
  const { categories } = useCategories();

  const isScan = from === 'scan';
  // Gescannte Daten aus dem Zwischenspeicher übernehmen (nur beim Öffnen).
  const [draft] = useState(() => (isScan && !id ? peekDraft() : null));

  const [fields, setFields] = useState<ContactFields>(() => ({ ...EMPTY_FIELDS, ...draft?.fields }));
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ContactPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<Partial<Record<Side, string>>>(() => ({
    front: draft?.frontUri,
    back: draft?.backUri,
  }));
  const [removedSides, setRemovedSides] = useState<Side[]>([]);
  const rawText = draft?.rawText;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getContact(db, id), listPhotos(db, id)]).then(([c, photos]) => {
        if (!c) return;
        const f = { ...EMPTY_FIELDS };
        (Object.keys(EMPTY_FIELDS) as (keyof ContactFields)[]).forEach((k) => {
          (f as Record<string, unknown>)[k] = c[k];
        });
        setFields(f);
        setCategoryIds(c.category_ids);
        setExistingPhotos(photos);
      });
  }, [db, id]);

  const set = (k: keyof ContactFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));

  const photoFor = (side: Side): string | undefined => {
    if (newPhotos[side]) return newPhotos[side];
    if (removedSides.includes(side)) return undefined;
    const p = existingPhotos.find((x) => x.side === side);
    return p ? photoUri(p.file_name) : undefined;
  };

  const pickPhoto = (side: Side) =>
    Alert.alert(side === 'front' ? 'Vorderseite' : 'Rückseite', undefined, [
      { text: 'Fotografieren', onPress: async () => { const u = await captureCard('camera'); if (u) setNewPhotos((p) => ({ ...p, [side]: u })); } },
      { text: 'Aus Fotos wählen', onPress: async () => { const u = await captureCard('library'); if (u) setNewPhotos((p) => ({ ...p, [side]: u })); } },
      ...(photoFor(side)
        ? [{ text: 'Foto entfernen', style: 'destructive' as const, onPress: () => {
            setNewPhotos((p) => ({ ...p, [side]: undefined }));
            setRemovedSides((r) => [...r, side]);
          } }]
        : []),
      { text: 'Abbrechen', style: 'cancel' },
    ]);

  const doSave = async () => {
    setSaving(true);
    try {
      const contactId = await saveContact(db, {
        id,
        fields,
        categoryIds,
        source: isScan ? 'scan' : 'manual',
      });
      for (const side of ['front', 'back'] as Side[]) {
        const old = existingPhotos.find((p) => p.side === side);
        if (newPhotos[side]) {
          const name = storePhoto(newPhotos[side]!, contactId, side);
          await upsertPhoto(db, contactId, side, name);
          if (old) deletePhotoFile(old.file_name);
        } else if (removedSides.includes(side) && old) {
          await deletePhotoRow(db, contactId, side);
          deletePhotoFile(old.file_name);
        }
      }
      if (isScan) clearDraft();
      if (id) router.back();
      else router.replace(`/kontakt/${contactId}`);
    } catch (e) {
      Alert.alert('Speichern fehlgeschlagen', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!fields.first_name.trim() && !fields.last_name.trim() && !fields.company.trim()) {
      Alert.alert('Name fehlt', 'Bitte mindestens Vorname, Nachname oder Firma eingeben.');
      return;
    }
    if (!id) {
      const all = await listContacts(db);
      const dup = all.find((c) =>
        isDuplicate(
          { first_name: c.first_name, last_name: c.last_name, phones: [c.phone, c.mobile], emails: [c.email] },
          { first_name: fields.first_name, last_name: fields.last_name, phones: [fields.phone, fields.mobile], emails: [fields.email] },
        ),
      );
      if (dup) {
        Alert.alert('Möglicherweise doppelt', `${displayName(dup)} existiert bereits mit gleicher Telefonnummer oder E-Mail.`, [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Vorhandenen öffnen', onPress: () => router.replace(`/kontakt/${dup.id}`) },
          { text: 'Trotzdem speichern', onPress: doSave },
        ]);
        return;
      }
    }
    doSave();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: id ? 'Kontakt bearbeiten' : isScan ? 'Visitenkarte prüfen' : 'Neuer Kontakt',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: t.primary, fontSize: 17 }}>Abbrechen</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={saving} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: t.primary, fontSize: 17, fontWeight: '700' }}>Sichern</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {isScan && (
          <Text style={{ color: t.muted, marginBottom: 12 }}>
            Bitte die erkannten Felder prüfen und korrigieren.
          </Text>
        )}

        <View style={styles.photos}>
          {(['front', 'back'] as Side[]).map((side) => {
            const uri = photoFor(side);
            return (
              <Pressable key={side} onPress={() => pickPhoto(side)} style={[styles.photoBox, { borderColor: t.border, backgroundColor: t.card }]}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
                    + {side === 'front' ? 'Vorderseite' : 'Rückseite'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Person</SectionTitle>
        <Card>
          <Field label="Vorname" value={fields.first_name} onChangeText={set('first_name')} autoCapitalize="words" />
          <Field label="Nachname" value={fields.last_name} onChangeText={set('last_name')} autoCapitalize="words" />
          <Field label="Firma" value={fields.company} onChangeText={set('company')} />
          <Field label="Position" value={fields.position} onChangeText={set('position')} />
        </Card>

        <SectionTitle>Kontakt</SectionTitle>
        <Card>
          <Field label="Telefon" value={fields.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label="Mobil" value={fields.mobile} onChangeText={set('mobile')} keyboardType="phone-pad" />
          <Field label="E-Mail" value={fields.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field label="Website" value={fields.website} onChangeText={set('website')} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
        </Card>

        <SectionTitle>Adresse</SectionTitle>
        <Card>
          <Field label="Straße" value={fields.street} onChangeText={set('street')} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 100 }}>
              <Field label="PLZ" value={fields.postal_code} onChangeText={set('postal_code')} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ort" value={fields.city} onChangeText={set('city')} />
            </View>
          </View>
          <Field label="Land" value={fields.country} onChangeText={set('country')} placeholder="z. B. Österreich" />
        </Card>

        <SectionTitle>Kategorien</SectionTitle>
        <Card>
          <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} />
        </Card>

        <SectionTitle>Kennenlernen & Notiz</SectionTitle>
        <Card>
          <DateField label="Datum des Kennenlernens" value={fields.met_on} onChange={(v) => setFields((f) => ({ ...f, met_on: v }))} />
          <Field label="Ort des Kennenlernens" value={fields.met_at} onChangeText={set('met_at')} placeholder="z. B. BNI-Treffen Linz" />
          <Field label="Notiz" value={fields.note} onChangeText={set('note')} multiline />
        </Card>

        {rawText ? (
          <>
            <SectionTitle>Erkannter Text</SectionTitle>
            <Card>
              <Text style={{ color: t.muted, fontSize: 13 }} selectable>
                {rawText}
              </Text>
            </Card>
          </>
        ) : null}

        <Button title="Sichern" icon="checkmark" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  photoBox: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
