import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useDataVersion } from '../lib/events';
import { processPendingGeocodes } from '../lib/geocoding';

/**
 * Holt fehlende Koordinaten im Hintergrund nach: beim Start, wenn die App
 * wieder in den Vordergrund kommt und nach Änderungen an Kontakten.
 */
export function GeoWorker() {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      processPendingGeocodes(db).catch((e) => console.warn('Geocoding', e));
    }, 1500);
    return () => clearTimeout(timer.current);
  }, [db, version]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') processPendingGeocodes(db).catch(() => {});
    });
    return () => sub.remove();
  }, [db]);

  return null;
}
