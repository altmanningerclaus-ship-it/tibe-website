import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category } from '../db/types';
import { textOn, useTheme } from '../theme';

/**
 * Mehrfachauswahl von Kategorien. Die erste gewählte Kategorie ist die
 * Hauptkategorie (bestimmt die Pin-Farbe); per Stern lässt sie sich ändern.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const t = useTheme();

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  const makeMain = (id: number) => onChange([id, ...value.filter((v) => v !== id)]);

  return (
    <View>
      <View style={styles.wrap}>
        {categories.map((c) => {
          const idx = value.indexOf(c.id);
          const active = idx >= 0;
          const fg = active ? textOn(c.color) : t.text;
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              onLongPress={() => (active ? makeMain(c.id) : onChange([c.id, ...value]))}
              style={[styles.chip, { borderColor: c.color, backgroundColor: active ? c.color : t.card }]}
            >
              {active && idx === 0 ? (
                <Ionicons name="star" size={14} color={fg} />
              ) : (
                <View style={[styles.dot, { backgroundColor: active ? fg : c.color }]} />
              )}
              <Text style={{ color: fg, fontWeight: '500' }}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {value.length > 1 && (
        <Text style={{ color: t.muted, fontSize: 12 }}>
          ★ = Hauptkategorie (Pin-Farbe). Lange drücken, um eine andere zur Hauptkategorie zu machen.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
