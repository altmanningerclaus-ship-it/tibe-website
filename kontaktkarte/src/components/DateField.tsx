import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateDe, toIsoDate } from '../lib/contact-utils';
import { useTheme } from '../theme';

function parseIso(iso: string | null): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const t = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
        <View style={styles.row}>
          {value ? (
            <DateTimePicker
              value={parseIso(value)}
              mode="date"
              display="compact"
              locale="de-AT"
              onChange={(_, d) => d && onChange(toIsoDate(d))}
            />
          ) : (
            <Pressable onPress={() => onChange(toIsoDate(new Date()))}>
              <Text style={{ color: t.primary, fontSize: 16 }}>Datum hinzufügen</Text>
            </Pressable>
          )}
          {value && (
            <Pressable onPress={() => onChange(null)}>
              <Text style={{ color: t.danger }}>Entfernen</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value: parseIso(value),
      mode: 'date',
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(toIsoDate(d));
      },
    });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <View style={styles.row}>
        <Pressable onPress={open} style={[styles.box, { borderColor: t.border, backgroundColor: t.inputBg }]}>
          <Text style={{ color: value ? t.text : t.muted, fontSize: 16 }}>
            {value ? formatDateDe(value) : 'Datum wählen'}
          </Text>
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)}>
            <Text style={{ color: t.danger }}>Entfernen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  box: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flex: 1 },
});
