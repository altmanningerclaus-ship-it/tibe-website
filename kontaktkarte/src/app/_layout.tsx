import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { GeoWorker } from '../components/GeoWorker';
import { LockGate } from '../components/LockGate';
import { DATABASE_NAME, migrate } from '../db/schema';
import { useTheme } from '../theme';

export default function RootLayout() {
  const t = useTheme();
  const navTheme = t.dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: t.primary, background: t.bg, card: t.card, border: t.border, text: t.text } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: t.primary, background: t.bg, card: t.card, border: t.border, text: t.text } };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
            <ActivityIndicator />
          </View>
        }
      >
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} useSuspense>
          <LockGate>
            <GeoWorker />
            <Stack screenOptions={{ headerBackTitle: 'Zurück' }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="kontakt/[id]" options={{ title: 'Kontakt' }} />
              <Stack.Screen name="kontakt/bearbeiten" options={{ title: 'Kontakt bearbeiten', presentation: 'modal' }} />
              <Stack.Screen name="kategorien" options={{ title: 'Kategorien' }} />
              <Stack.Screen name="adressbuch" options={{ title: 'Adressbuch-Import' }} />
              <Stack.Screen name="sicherung" options={{ title: 'Datensicherung' }} />
            </Stack>
          </LockGate>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
