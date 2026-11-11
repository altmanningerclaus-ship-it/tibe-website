import type { ContactFields, ContactWithCategories } from '../db/types';

/** Zufällige UUID v4 (für lokale IDs ausreichend, kein Netzwerk nötig). */
export function uuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}

type NameLike = Pick<ContactFields, 'first_name' | 'last_name' | 'company'>;

export function displayName(c: NameLike): string {
  const name = `${c.first_name} ${c.last_name}`.trim();
  return name || c.company || 'Ohne Namen';
}

/** Sortierschlüssel „Nachname Vorname“. */
export function sortName(c: NameLike): string {
  return `${c.last_name} ${c.first_name}`.trim().toLocaleLowerCase('de') || c.company.toLocaleLowerCase('de');
}

type AddressLike = Pick<ContactFields, 'street' | 'postal_code' | 'city' | 'country'>;

/** Adresse als eine Zeile für Geocoding/Anzeige; leer, wenn kein Ort bekannt ist. */
export function addressQuery(c: AddressLike): string {
  const cityLine = `${c.postal_code} ${c.city}`.trim();
  if (!cityLine && !c.street.trim()) return '';
  return [c.street.trim(), cityLine, c.country.trim()].filter(Boolean).join(', ');
}

export function hasAddress(c: AddressLike): boolean {
  return !!(c.city.trim() || c.postal_code.trim());
}

/** Nur Ziffern; österreichische/deutsche Vorwahl vereinheitlicht (0664… == +43664…). */
export function normalizePhone(p: string): string {
  let d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  d = d.replace(/^\+(43|49|41)0?/, '0');
  return d.replace(/\D/g, '');
}

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function normalizeName(first: string, last: string): string {
  return `${first} ${last}`
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ß]+/g, ' ')
    .trim();
}

export type DuplicateProbe = {
  first_name: string;
  last_name: string;
  phones: string[];
  emails: string[];
};

/**
 * Duplikat = gleicher Name UND mindestens eine gemeinsame Telefonnummer oder E-Mail.
 */
export function isDuplicate(a: DuplicateProbe, b: DuplicateProbe): boolean {
  const na = normalizeName(a.first_name, a.last_name);
  if (!na || na !== normalizeName(b.first_name, b.last_name)) return false;
  const pa = new Set(a.phones.map(normalizePhone).filter((x) => x.length >= 6));
  if (b.phones.map(normalizePhone).some((p) => pa.has(p))) return true;
  const ea = new Set(a.emails.map(normalizeEmail).filter(Boolean));
  return b.emails.map(normalizeEmail).some((e) => ea.has(e));
}

export function formatDateDe(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function websiteUrl(w: string): string {
  const t = w.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Volltextsuche über Name, Firma, Ort usw.; alle Suchwörter müssen vorkommen. */
export function matchesQuery(c: ContactWithCategories, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [c.first_name, c.last_name, c.company, c.city, c.postal_code, c.country, c.position, c.email]
    .join(' ')
    .toLocaleLowerCase('de');
  return q
    .toLocaleLowerCase('de')
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => hay.includes(part));
}
