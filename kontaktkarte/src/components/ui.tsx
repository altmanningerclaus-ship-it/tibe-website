import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { textOn, useTheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, icon, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : variant === 'secondary' ? t.card : 'transparent';
  const fg = variant === 'primary' ? t.primaryText : variant === 'danger' ? '#fff' : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === 'secondary' ? t.border : 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: t.primary + '22' }]}>
        <Ionicons name={icon} size={22} color={t.primary} />
      </View>
      <Text style={[styles.iconLabel, { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.inputBg, borderColor: t.border },
          props.multiline && { minHeight: 80, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}

export function SearchBar(props: TextInputProps) {
  const t = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: t.inputBg, borderColor: t.border }]}>
      <Ionicons name="search" size={18} color={t.muted} />
      <TextInput
        placeholderTextColor={t.muted}
        clearButtonMode="while-editing"
        autoCorrect={false}
        {...props}
        style={[styles.searchInput, { color: t.text }]}
      />
    </View>
  );
}

export function Chip({
  label,
  color,
  active,
  onPress,
  onLongPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.chip,
        { borderColor: c, backgroundColor: active ? c : t.card },
      ]}
    >
      {color && !active && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, { color: active ? textOn(c) : t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={t.muted} />
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      {text ? <Text style={[styles.emptyText, { color: t.muted }]}>{text}</Text> : null}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1, borderBottomColor: t.border }]}
    >
      {icon && <Ionicons name={icon} size={22} color={t.primary} style={{ width: 28 }} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.muted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 12 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 8, marginBottom: 6, letterSpacing: 0.5 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { alignItems: 'center', flex: 1, gap: 6 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontSize: 12 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16, height: 44 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: 220,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 16 },
  rowSub: { fontSize: 13, marginTop: 2 },
});
