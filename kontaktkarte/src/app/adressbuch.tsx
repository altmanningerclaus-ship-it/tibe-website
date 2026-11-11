import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { CategoryPicker } from '../components/CategoryPicker';
import { Button, Card, Empty, SearchBar } from '../components/ui';
import { listContacts, saveContact } from '../db/repo';
import type { ContactFields } from '../db/types';
import { FIELD_KEYS } from '../db/types';
import { useCategories } from '../hooks/data';
import {
  changedFields,
  matchCandidates,
  readAddressBook,
  requestAddressBookAccess,
  type AddressBookCandidate,
} from '../lib/addressbook';
import { displayName, sortName } from '../lib/contact-utils';
import { emitDataChanged } from '../lib/events';
import { useTheme } from '../theme';

const STATUS_TEXT: Record<AddressBookCandidate['status'], string> = {
  new: 'Neu',
  changed: 'Im Adressbuch geändert',
  same: 'Bereits importiert',
  duplicate: 'Bereits vorhanden (Duplikat)',
};

type LoadResult = { denied: true } | { denied: false; limited: boolean; candidates: AddressBookCandidate[] };

async function loadCandidates(db: SQLiteDatabase): Promise<LoadResult> {
  const access = await requestAddressBookAccess();
  if (!access.granted) return { denied: true };
  const [entries, locals] = await Promise.all([readAddressBook(), listContacts(db)]);
  const candidates = matchCandidates(entries, locals).sort((a, b) =>
    sortName(a.fields).localeCompare(sortName(b.fields), 'de'),
  );
  return { denied: false, limited: access.limited, candidates };
}

export default function AddressBookImport() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { categories } = useCategories();

  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [limited, setLimited] = useState(false);
  const [candidates, setCandidates] = useState<AddressBookCandidate[]>([]);
  const [withoutAddress, setWithoutAddress] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [importing, setImporting] = useState<string | null>(null);

  const apply = useCallback((r: LoadResult) => {
    if (r.denied) return setState('denied');
    setLimited(r.limited);
    setCandidates(r.candidates);
    setSelected(new Set());
    setState('ready');
  }, []);

  const fail = useCallback((e: unknown) => {
    Alert.alert('Adressbuch konnte nicht gelesen werden', String((e as Error)?.message ?? e));
    setState('denied');
  }, []);

  const reload = () => {
    setState('loading');
    loadCandidates(db).then(apply, fail);
  };

  useEffect(() => {
    loadCandidates(db).then(apply, fail);
  }, [db, apply, fail]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('de');
    return candidates.filter((c) => {
      if (!withoutAddress && !c.hasAddress) return false;
      if (!showExisting && (c.status === 'same' || c.status === 'duplicate')) return false;
      if (q && !`${c.fields.first_name} ${c.fields.last_name} ${c.fields.company} ${c.fields.city}`.toLocaleLowerCase('de').includes(q)) return false;
      return true;
    });
  }, [candidates, withoutAddress, showExisting, query]);

  const selectable = visible.filter((c) => c.status === 'new' || c.status === 'changed');
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.externalId));
  const stats = useMemo(() => {
    const s = { new: 0, changed: 0, same: 0, duplicate: 0 };
    candidates.forEach((c) => {
      if (withoutAddress || c.hasAddress) s[c.status]++;
    });
    return s;
  }, [candidates, withoutAddress]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runImport = async () => {
    const chosen = candidates.filter((c) => selected.has(c.externalId));
    if (!chosen.length) return;
    const locals = new Map((await listContacts(db)).map((l) => [l.id, l]));
    let added = 0;
    let updated = 0;
    try {
      for (const [i, c] of chosen.entries()) {
        setImporting(`${i + 1} / ${chosen.length}`);
        if (c.status === 'changed' && c.localId) {
          const local = locals.get(c.localId);
          if (!local) continue;
          const fields = {} as ContactFields;
          FIELD_KEYS.forEach((k) => ((fields as Record<string, unknown>)[k] = local[k]));
          changedFields(c, local).forEach((k) => ((fields as Record<string, unknown>)[k] = c.fields[k]));
          const cats = [...local.category_ids, ...categoryIds.filter((id) => !local.category_ids.includes(id))];
          await saveContact(db, { id: local.id, fields, categoryIds: cats, silent: true });
          updated++;
        } else {
          await saveContact(db, {
            fields: c.fields,
            categoryIds,
            source: 'addressbook',
            externalId: c.externalId,
            silent: true,
          });
          added++;
        }
      }
    } finally {
      setImporting(null);
      emitDataChanged();
    }
    Alert.alert(
      'Import abgeschlossen',
      `${added} neu übernommen, ${updated} aktualisiert.\nStandorte werden im Hintergrund ermittelt.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  if (state === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator />
        <Text style={{ color: t.muted, marginTop: 8 }}>Adressbuch wird gelesen …</Text>
      </View>
    );
  }

  if (state === 'denied') {
    return (
      <View style={[styles.center, { backgroundColor: t.bg, padding: 24 }]}>
        <Empty icon="lock-closed-outline" title="Kein Zugriff auf das Adressbuch" text="Bitte den Zugriff in den Systemeinstellungen erlauben." />
        <Button title="Einstellungen öffnen" onPress={() => Linking.openSettings()} />
        <Button title="Erneut versuchen" variant="ghost" onPress={reload} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.externalId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 12, paddingBottom: 320 }}
        ListHeaderComponent={
          <View>
            <Text style={{ color: t.muted, marginBottom: 8 }}>
              Das System-Adressbuch wird nur gelesen und nicht verändert. {stats.new} neu · {stats.changed} geändert ·{' '}
              {stats.same + stats.duplicate} bereits vorhanden
            </Text>
            {limited && (
              <Text style={{ color: t.danger, marginBottom: 8 }}>
                Eingeschränkter Zugriff: Es werden nur die freigegebenen Kontakte angezeigt.
              </Text>
            )}
            <SearchBar placeholder="Suchen" value={query} onChangeText={setQuery} />
            <View style={styles.switchRow}>
              <Text style={{ color: t.text, flex: 1 }}>Auch Kontakte ohne Adresse (ohne Pin)</Text>
              <Switch value={withoutAddress} onValueChange={setWithoutAddress} />
            </View>
            <View style={styles.switchRow}>
              <Text style={{ color: t.text, flex: 1 }}>Bereits vorhandene anzeigen</Text>
              <Switch value={showExisting} onValueChange={setShowExisting} />
            </View>
            <Pressable
              onPress={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  selectable.forEach((c) => (allSelected ? next.delete(c.externalId) : next.add(c.externalId)));
                  return next;
                })
              }
              style={styles.selectAll}
            >
              <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={22} color={t.primary} />
              <Text style={{ color: t.primary, fontWeight: '600' }}>
                {allSelected ? 'Auswahl aufheben' : `Alle ${selectable.length} auswählen`}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={<Empty icon="checkmark-done-outline" title="Nichts Neues zu importieren" />}
        renderItem={({ item: c }) => {
          const can = c.status === 'new' || c.status === 'changed';
          const on = selected.has(c.externalId);
          return (
            <Pressable
              disabled={!can}
              onPress={() => toggle(c.externalId)}
              style={[styles.item, { backgroundColor: t.card, borderColor: t.border, opacity: can ? 1 : 0.5 }]}
            >
              <Ionicons name={!can ? 'checkmark-circle-outline' : on ? 'checkbox' : 'square-outline'} size={24} color={can ? t.primary : t.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                  {displayName(c.fields)}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                  {[c.fields.company, [c.fields.postal_code, c.fields.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'ohne Adresse'}
                </Text>
                {c.status !== 'new' && <Text style={{ color: c.status === 'changed' ? t.primary : t.muted, fontSize: 12 }}>{STATUS_TEXT[c.status]}</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      <Card style={[styles.footer, { borderColor: t.border }]}>
        <Text style={{ color: t.muted, fontSize: 12, marginBottom: 6 }}>Kategorie für die Auswahl (optional, mehrere möglich)</Text>
        <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} />
        <Button
          title={importing ? `Importiere ${importing}` : `${selected.size} Kontakt(e) übernehmen`}
          icon="download-outline"
          onPress={runImport}
          disabled={!selected.size}
          loading={!!importing}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  footer: { position: 'absolute', left: 8, right: 8, bottom: 8, marginBottom: 0, borderWidth: 1 },
});
