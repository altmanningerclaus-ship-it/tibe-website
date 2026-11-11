import { Alert, Linking, Platform } from 'react-native';

import type { Contact } from '../db/types';
import { addressQuery, displayName, websiteUrl } from './contact-utils';

async function open(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Nicht möglich', 'Auf diesem Gerät gibt es keine passende App dafür.');
  }
}

export const call = (num: string) => open(`tel:${num.replace(/[^\d+]/g, '')}`);
export const mail = (email: string) => open(`mailto:${email.trim()}`);
export const web = (url: string) => open(websiteUrl(url));

/** Öffnet die Karten-App (Apple Karten bzw. Google Maps) mit Navigation zum Kontakt. */
export function navigate(c: Contact) {
  const label = encodeURIComponent(displayName(c));
  const hasCoords = c.latitude != null && c.longitude != null;
  const q = encodeURIComponent(addressQuery(c));
  if (Platform.OS === 'ios') {
    return open(
      hasCoords
        ? `maps://?daddr=${c.latitude},${c.longitude}&q=${label}`
        : `maps://?daddr=${q}`,
    );
  }
  return open(
    hasCoords ? `geo:${c.latitude},${c.longitude}?q=${c.latitude},${c.longitude}(${label})` : `geo:0,0?q=${q}`,
  );
}
