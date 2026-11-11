import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Supercluster from 'supercluster';

import { Chip, Dot, SearchBar } from '../../components/ui';
import type { ContactWithCategories } from '../../db/types';
import { mainColor, useCategories, useContacts } from '../../hooks/data';
import { displayName, matchesQuery } from '../../lib/contact-utils';
import { DARK_MAP_STYLE } from '../../lib/map-style';
import { textOn, useTheme } from '../../theme';

type PointProps = { id: string; color: string };

const START_REGION: Region = { latitude: 47.6, longitude: 13.8, latitudeDelta: 6, longitudeDelta: 6 };

function zoomFromRegion(r: Region) {
  return Math.max(0, Math.min(20, Math.round(Math.log2(360 / Math.max(r.longitudeDelta, 1e-6)))));
}

function bboxFromRegion(r: Region): [number, number, number, number] {
  const west = r.longitude - r.longitudeDelta / 2;
  const east = r.longitude + r.longitudeDelta / 2;
  const south = Math.max(-85, r.latitude - r.latitudeDelta / 2);
  const north = Math.min(85, r.latitude + r.latitudeDelta / 2);
  if (r.longitudeDelta >= 360 || west < -180 || east > 180) return [-180, south, 180, north];
  return [west, south, east, north];
}

export default function MapScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const { contacts } = useContacts();
  const { categories, byId } = useCategories();

  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [region, setRegion] = useState<Region>(START_REGION);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [legend, setLegend] = useState(false);
  const [frozen, setFrozen] = useState<unknown>(null);
  const fitted = useRef(false);

  // Sichtbar: Kontakte mit Standort, deren Kategorien nicht alle ausgeblendet sind.
  const visible = useMemo(
    () =>
      contacts.filter((c) => {
        if (c.latitude == null || c.longitude == null) return false;
        if (hidden.size === 0) return true;
        if (c.category_ids.length === 0) return !hidden.has(-1);
        return c.category_ids.some((id) => !hidden.has(id));
      }),
    [contacts, hidden],
  );

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 56, maxZoom: 16 });
    sc.load(
      visible.map((c) => ({
        type: 'Feature' as const,
        // Farbe der ersten (nicht ausgeblendeten) Kategorie = Hauptkategorie
        properties: {
          id: c.id,
          color: byId.get(c.category_ids.find((id) => !hidden.has(id) && byId.has(id)) ?? -1)?.color ?? '#808080',
        },
        geometry: { type: 'Point' as const, coordinates: [c.longitude!, c.latitude!] },
      })),
    );
    return sc;
  }, [visible, byId, hidden]);

  const clusters = useMemo(() => index.getClusters(bboxFromRegion(region), zoomFromRegion(region)), [index, region]);

  // Marker-Views kurz neu zeichnen lassen, danach für Performance einfrieren.
  const renderKey = useMemo(() => ({ clusters, dark: t.dark }), [clusters, t.dark]);
  const tracks = frozen !== renderKey;
  useEffect(() => {
    const id = setTimeout(() => setFrozen(renderKey), 800);
    return () => clearTimeout(id);
  }, [renderKey]);

  // Beim ersten Laden auf alle Kontakte zoomen.
  useEffect(() => {
    if (fitted.current || visible.length === 0) return;
    fitted.current = true;
    setTimeout(() => {
      map.current?.fitToCoordinates(
        visible.map((c) => ({ latitude: c.latitude!, longitude: c.longitude! })),
        { edgePadding: { top: 160, right: 60, bottom: 120, left: 60 }, animated: false },
      );
    }, 300);
  }, [visible]);

  const focus = useCallback((c: ContactWithCategories) => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setSelected(c.id);
    if (c.latitude != null && c.longitude != null) {
      map.current?.animateToRegion(
        { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
        600,
      );
    }
  }, []);

  const results = useMemo(
    () => (query.trim() ? contacts.filter((c) => matchesQuery(c, query)).slice(0, 8) : []),
    [contacts, query],
  );

  const sel = selected ? contacts.find((c) => c.id === selected) : undefined;
  const withoutLocation = contacts.length - contacts.filter((c) => c.latitude != null).length;

  const toggle = (id: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    contacts.forEach((c) => c.category_ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [contacts]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={START_REGION}
        onRegionChangeComplete={setRegion}
        onPress={() => {
          setSelected(null);
          setSearchOpen(false);
          Keyboard.dismiss();
        }}
        userInterfaceStyle={t.dark ? 'dark' : 'light'}
        customMapStyle={Platform.OS === 'android' && t.dark ? DARK_MAP_STYLE : undefined}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {clusters.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          if ('cluster' in f.properties && f.properties.cluster) {
            const count = f.properties.point_count;
            const size = count < 10 ? 36 : count < 50 ? 44 : 54;
            const clusterId = f.properties.cluster_id;
            return (
              <Marker
                key={`c-${clusterId}`}
                coordinate={{ latitude: lat, longitude: lng }}
                tracksViewChanges={tracks}
                onPress={(e) => {
                  e.stopPropagation();
                  const z = Math.min(index.getClusterExpansionZoom(clusterId), 18);
                  const delta = 360 / 2 ** z;
                  map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }, 500);
                }}
              >
                <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.primary }]}>
                  <Text style={{ color: t.primaryText, fontWeight: '700' }}>{count}</Text>
                </View>
              </Marker>
            );
          }
          const p = f.properties as PointProps;
          const isSel = p.id === selected;
          return (
            <Marker
              key={`p-${p.id}-${p.color}-${isSel ? 1 : 0}`}
              coordinate={{ latitude: lat, longitude: lng }}
              tracksViewChanges={tracks}
              anchor={{ x: 0.5, y: 1 }}
              onPress={(e) => {
                e.stopPropagation();
                setSelected(p.id);
              }}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pin, { backgroundColor: p.color, transform: [{ scale: isSel ? 1.25 : 1 }] }]}>
                  <View style={styles.pinDot} />
                </View>
                <View style={[styles.pinTip, { borderTopColor: p.color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Suche + Filter */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <SearchBar
          placeholder="Name, Firma oder Ort suchen"
          value={query}
          onChangeText={(q) => {
            setQuery(q);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          returnKeyType="search"
          onSubmitEditing={() => results[0] && focus(results[0])}
        />
        {searchOpen && results.length > 0 && (
          <View style={[styles.results, { backgroundColor: t.card, borderColor: t.border }]}>
            {results.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => (c.latitude != null ? focus(c) : router.push(`/kontakt/${c.id}`))}
                style={({ pressed }) => [styles.resultRow, { backgroundColor: pressed ? t.border : 'transparent' }]}
              >
                <Dot color={mainColor(c, byId, t.muted)} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                    {displayName(c)}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                    {[c.company, c.city].filter(Boolean).join(' · ')}
                    {c.latitude == null ? ' · ohne Standort' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
          <Chip label="Alle" active={hidden.size === 0} onPress={() => setHidden(new Set())} />
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} active={!hidden.has(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </ScrollView>
      </View>

      {/* Legende */}
      <Pressable
        onPress={() => setLegend((v) => !v)}
        style={[styles.legendBtn, { backgroundColor: t.card, borderColor: t.border, bottom: sel ? 150 : 20 }]}
        accessibilityLabel="Legende"
      >
        <Ionicons name={legend ? 'close' : 'color-palette-outline'} size={22} color={t.primary} />
      </Pressable>
      {legend && (
        <View style={[styles.legend, { backgroundColor: t.card, borderColor: t.border, bottom: sel ? 200 : 70 }]}>
          <Text style={{ color: t.text, fontWeight: '700', marginBottom: 6 }}>Legende</Text>
          {categories.map((c) => (
            <View key={c.id} style={styles.legendRow}>
              <Dot color={c.color} />
              <Text style={{ color: t.text, flex: 1 }}>{c.name}</Text>
              <Text style={{ color: t.muted }}>{counts.get(c.id) ?? 0}</Text>
            </View>
          ))}
          <View style={styles.legendRow}>
            <Dot color="#808080" />
            <Text style={{ color: t.text, flex: 1 }}>Ohne Kategorie</Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>
            {visible.length} auf der Karte{withoutLocation ? ` · ${withoutLocation} ohne Standort` : ''}
          </Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>Pin-Farbe = Hauptkategorie</Text>
        </View>
      )}

      {/* Kurzkarte */}
      {sel && (
        <Pressable
          onPress={() => router.push(`/kontakt/${sel.id}`)}
          style={[styles.callout, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.calloutName, { color: t.text }]} numberOfLines={1}>
              {displayName(sel)}
            </Text>
            {!!sel.company && (
              <Text style={{ color: t.muted }} numberOfLines={1}>
                {sel.company}
              </Text>
            )}
            <View style={styles.calloutCats}>
              {sel.category_ids.map((id) => {
                const cat = byId.get(id);
                return cat ? (
                  <View key={id} style={[styles.badge, { backgroundColor: cat.color }]}>
                    <Text style={{ color: textOn(cat.color), fontSize: 12, fontWeight: '600' }}>{cat.name}</Text>
                  </View>
                ) : null;
              })}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={t.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12, top: 0 },
  results: { marginTop: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  cluster: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#ffffff' },
  pinWrap: { alignItems: 'center' },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  legendBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  legend: {
    position: 'absolute',
    right: 16,
    minWidth: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    elevation: 4,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  callout: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  calloutName: { fontSize: 17, fontWeight: '700' },
  calloutCats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
});
