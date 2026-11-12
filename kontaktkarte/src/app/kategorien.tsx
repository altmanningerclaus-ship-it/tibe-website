import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Dot, Field } from '../components/ui';
import { countContactsInCategory, createCategory, deleteCategory, updateCategory } from '../db/repo';
import type { Category } from '../db/types';
import { useCategories } from '../hooks/data';
import { CATEGORY_PALETTE, useTheme } from '../theme';

type EditState = { id?: number; name: string; color: string } | null;

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { categories } = useCategories();
  const [edit, setEdit] = useState<EditState>(null);

  const usedColors = new Set(categories.map((c) => c.color.toUpperCase()));
  const freeColor = CATEGORY_PALETTE.find((c) => !usedColors.has(c.toUpperCase())) ?? CATEGORY_PALETTE[0];

  const save = async () => {
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) return Alert.alert('Name fehlt');
    if (categories.some((c) => c.id !== edit.id && c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'))) {
      return Alert.alert('Kategorie existiert bereits');
    }
    if (edit.id) await updateCategory(db, edit.id, name, edit.color);
    else await createCategory(db, name, edit.color);
    setEdit(null);
  };

  const remove = async (c: Category) => {
    const n = await countContactsInCategory(db, c.id);
    Alert.alert(
      `„${c.name}“ löschen?`,
      n ? `${n} Kontakt(e) verlieren diese Kategorie. Die Kontakte selbst bleiben erhalten.` : undefined,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(db, c.id);
            setEdit(null);
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ paddingVertical: 4 }}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setEdit({ id: c.id, name: c.name, color: c.color })}
              style={[styles.row, { borderBottomColor: t.border }]}
            >
              <Dot color={c.color} size={20} />
              <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{c.name}</Text>
              <Text style={{ color: t.primary }}>Bearbeiten</Text>
            </Pressable>
          ))}
        </Card>
        <Button title="Neue Kategorie" icon="add" onPress={() => setEdit({ name: '', color: freeColor })} />
        <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>
          Ein Kontakt kann mehreren Kategorien angehören. Die zuerst gewählte (Hauptkategorie) bestimmt die Pin-Farbe auf der Karte.
        </Text>
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEdit(null)} />
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          <Text style={[styles.sheetTitle, { color: t.text }]}>{edit?.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</Text>
          <Field label="Name" value={edit?.name ?? ''} onChangeText={(name) => setEdit((e) => (e ? { ...e, name } : e))} autoFocus={!edit?.id} />
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 6 }}>Farbe</Text>
          <View style={styles.palette}>
            {CATEGORY_PALETTE.map((color) => {
              const active = edit?.color.toUpperCase() === color.toUpperCase();
              const taken = usedColors.has(color.toUpperCase()) && !active;
              return (
                <Pressable
                  key={color}
                  onPress={() => setEdit((e) => (e ? { ...e, color } : e))}
                  style={[styles.swatch, { backgroundColor: color, borderColor: active ? t.text : 'transparent', opacity: taken ? 0.35 : 1 }]}
                  accessibilityLabel={`Farbe ${color}${taken ? ' (bereits verwendet)' : ''}`}
                />
              );
            })}
          </View>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>Blasse Farben werden bereits verwendet.</Text>
          <Button title="Speichern" onPress={save} />
          {edit?.id && (
            <Button
              title="Kategorie löschen"
              variant="ghost"
              icon="trash-outline"
              onPress={() => {
                const c = categories.find((x) => x.id === edit.id);
                if (c) remove(c);
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, backgroundColor: '#0006' },
  sheet: { padding: 20, paddingBottom: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
});
