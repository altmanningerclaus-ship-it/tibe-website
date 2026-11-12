import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip, Dot, Empty, SearchBar } from '../../components/ui';
import type { ContactWithCategories } from '../../db/types';
import { mainColor, useCategories, useContacts } from '../../hooks/data';
import { displayName, matchesQuery, sortName } from '../../lib/contact-utils';
import { useTheme } from '../../theme';

type SortKey = 'name' | 'company' | 'city';
const SORT_LABELS: Record<SortKey, string> = { name: 'Name', company: 'Firma', city: 'Ort' };

export default function ListScreen() {
  const t = useTheme();
  const { contacts, loading } = useContacts();
  const { categories, byId } = useCategories();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<SortKey>('name');

  const data = useMemo(() => {
    const list = contacts.filter(
      (c) => matchesQuery(c, query) && (filter.size === 0 || c.category_ids.some((id) => filter.has(id))),
    );
    const key = (c: ContactWithCategories) =>
      sort === 'name'
        ? sortName(c)
        : sort === 'company'
          ? (c.company || '￿').toLocaleLowerCase('de') + sortName(c)
          : (c.city || '￿').toLocaleLowerCase('de') + sortName(c);
    return list.sort((a, b) => key(a).localeCompare(key(b), 'de'));
  }, [contacts, query, filter, sort]);

  const toggle = (id: number) =>
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: `Kontakte (${contacts.length})`,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/kontakt/bearbeiten')}
              accessibilityLabel="Kontakt manuell anlegen"
              style={{ paddingHorizontal: 16 }}
            >
              <Ionicons name="person-add-outline" size={24} color={t.primary} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.top}>
        <SearchBar placeholder="Name, Firma oder Ort suchen" value={query} onChangeText={setQuery} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <Chip label="Alle" active={filter.size === 0} onPress={() => setFilter(new Set())} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} active={filter.has(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          <Text style={{ color: t.muted }}>Sortieren:</Text>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <Pressable key={k} onPress={() => setSort(k)}>
              <Text style={[styles.sort, { color: sort === k ? t.primary : t.muted, fontWeight: sort === k ? '700' : '400' }]}>
                {SORT_LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          loading ? undefined : (
            <Empty
              icon="people-outline"
              title={contacts.length ? 'Keine Treffer' : 'Noch keine Kontakte'}
              text={contacts.length ? 'Suche oder Filter anpassen.' : 'Visitenkarte scannen, manuell anlegen oder aus dem Adressbuch importieren.'}
            />
          )
        }
        renderItem={({ item: c }) => {
          const cats = c.category_ids.map((id) => byId.get(id)).filter(Boolean);
          const sub = [c.company, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
          return (
            <Pressable
              onPress={() => router.push(`/kontakt/${c.id}`)}
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? t.border : t.card, borderBottomColor: t.border }]}
            >
              <Dot color={mainColor(c, byId, t.muted)} size={14} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                  {displayName(c)}
                </Text>
                {sub ? (
                  <Text style={{ color: t.muted }} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
                {cats.length > 1 && (
                  <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                    {cats.map((x) => x!.name).join(', ')}
                  </Text>
                )}
              </View>
              {(c.geo_status === 'failed' || c.geo_status === 'none') && (
                <Ionicons name="location-outline" size={16} color={t.muted} accessibilityLabel="ohne Standort" style={{ opacity: 0.6 }} />
              )}
              {c.geo_status === 'pending' && <Ionicons name="time-outline" size={16} color={t.muted} accessibilityLabel="Standort wird gesucht" />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: 12, paddingBottom: 4 },
  sortRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 4 },
  sort: { fontSize: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 16, fontWeight: '600' },
});
