import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Karte',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="liste"
        options={{
          title: 'Liste',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scannen"
        options={{
          title: 'Scannen',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Visitenkarte scannen',
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              accessibilityRole="button"
              accessibilityLabel="Visitenkarte scannen"
              style={styles.scanWrap}
            >
              <View style={[styles.scanButton, { backgroundColor: t.primary, borderColor: t.card }]}>
                <Ionicons name="scan" size={30} color={t.primaryText} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="einstellungen"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
