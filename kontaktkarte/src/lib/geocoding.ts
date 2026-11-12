import * as Location from 'expo-location';
import type { SQLiteDatabase } from 'expo-sqlite';

import { listPendingGeocodes, setGeocodeResult } from '../db/repo';
import { emitDataChanged } from './events';

/**
 * Geocoding über den System-Dienst (Apple / Google Play Services).
 * Ergebnisse werden in der DB gespeichert, damit jede Adresse nur einmal
 * abgefragt wird. Ohne Internet bleibt der Status „pending“ und wird beim
 * nächsten Lauf nachgeholt.
 */
const DELAY_MS = 1300; // Systemdienste drosseln (iOS ~50 Anfragen/Minute)

let running = false;

export type GeocodeProgress = { done: number; remaining: number };

async function ensurePermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.granted;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class TemporaryGeocodeError extends Error {}

async function geocode(query: string): Promise<{ latitude: number; longitude: number } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hits = await Promise.race([
      Location.geocodeAsync(query),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TemporaryGeocodeError('timeout')), 15000);
      }),
    ]);
    const hit = hits.find((h) => Number.isFinite(h.latitude) && Number.isFinite(h.longitude));
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch (e) {
    // Netzwerk, Drosselung, Dienst nicht verfügbar → später erneut versuchen.
    throw e instanceof TemporaryGeocodeError ? e : new TemporaryGeocodeError(String(e));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Manche Systeme liefern offline einfach „kein Treffer“ statt eines Fehlers.
 * Ein Referenzort prüft daher, ob der Dienst gerade erreichbar ist.
 */
async function serviceReachable(): Promise<boolean> {
  try {
    return (await geocode('Wien, Österreich')) !== null;
  } catch {
    return false;
  }
}

export async function processPendingGeocodes(
  db: SQLiteDatabase,
  onProgress?: (p: GeocodeProgress) => void,
): Promise<void> {
  if (running) return;
  running = true;
  try {
    const first = await listPendingGeocodes(db, 1);
    if (!first.length) return;
    if (!(await ensurePermission())) return;
    if (!(await serviceReachable())) return;

    let done = 0;
    let emptyStreak = 0;
    for (;;) {
      const batch = await listPendingGeocodes(db, 25);
      if (!batch.length) break;
      for (const [i, item] of batch.entries()) {
        await sleep(DELAY_MS);
        let result: { latitude: number; longitude: number } | null;
        try {
          result = await geocode(item.geo_query);
        } catch {
          return; // vorübergehender Fehler – Rest bleibt „pending“
        }
        if (!result) {
          emptyStreak++;
          if (emptyStreak >= 3 && !(await serviceReachable())) return;
        } else {
          emptyStreak = 0;
        }
        await setGeocodeResult(db, item.id, item.geo_query, result);
        done++;
        onProgress?.({ done, remaining: batch.length - i - 1 });
      }
      emitDataChanged();
    }
  } finally {
    running = false;
    emitDataChanged();
  }
}
