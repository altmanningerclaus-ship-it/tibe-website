import { Contact as SystemContact, ContactField, requestPermissionsAsync } from 'expo-contacts';

import type { ContactFields, ContactWithCategories } from '../db/types';
import { EMPTY_FIELDS } from '../db/types';
import { addressQuery, isDuplicate } from './contact-utils';

/**
 * Liest das System-Adressbuch (nur lesend – es wird nichts verändert).
 */
const FIELDS = [
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.COMPANY,
  ContactField.JOB_TITLE,
  ContactField.PHONES,
  ContactField.EMAILS,
  ContactField.ADDRESSES,
  ContactField.URL_ADDRESSES,
  ContactField.NOTE,
] as const;

export type AddressBookEntry = {
  externalId: string;
  fields: ContactFields;
  phones: string[];
  emails: string[];
  hasAddress: boolean;
};

export type MatchStatus = 'new' | 'changed' | 'same' | 'duplicate';

export type AddressBookCandidate = AddressBookEntry & {
  status: MatchStatus;
  /** Lokaler Kontakt, falls bereits vorhanden. */
  localId?: string;
};

function pickPhone(phones: { label?: string; number?: string }[], mobile: boolean): string {
  const isMobile = (l?: string) => /mobil|mobile|cell|handy|iphone/i.test(l ?? '');
  const hit = phones.find((p) => p.number && isMobile(p.label) === mobile);
  return hit?.number ?? '';
}

export async function requestAddressBookAccess(): Promise<{ granted: boolean; limited: boolean }> {
  const r = await requestPermissionsAsync();
  return { granted: r.granted, limited: r.accessPrivileges === 'limited' };
}

export async function readAddressBook(): Promise<AddressBookEntry[]> {
  const all = await SystemContact.getAllDetails(FIELDS);
  return all.map((c) => {
    const phones = (c.phones ?? []).filter((p) => p.number);
    const emails = (c.emails ?? []).map((e) => e.address ?? '').filter(Boolean);
    const addr = (c.addresses ?? []).find((a) => a.city || a.postcode || a.street) ?? null;
    let phone = pickPhone(phones, false);
    let mobile = pickPhone(phones, true);
    if (!phone && !mobile && phones[0]?.number) phone = phones[0].number;
    if (!phone && phones.length > 1) phone = phones.find((p) => p.number !== mobile)?.number ?? '';
    if (!mobile && phones.length > 1) mobile = phones.find((p) => p.number !== phone)?.number ?? '';

    const fields: ContactFields = {
      ...EMPTY_FIELDS,
      first_name: c.givenName ?? '',
      last_name: c.familyName ?? '',
      company: c.company ?? '',
      position: c.jobTitle ?? '',
      phone,
      mobile,
      email: emails[0] ?? '',
      website: c.urlAddresses?.find((u) => u.url)?.url ?? '',
      street: addr?.street?.replace(/\n/g, ', ') ?? '',
      postal_code: addr?.postcode ?? '',
      city: addr?.city ?? '',
      country: addr?.country ?? '',
    };
    return {
      externalId: c.id,
      fields,
      phones: phones.map((p) => p.number!),
      emails,
      hasAddress: !!addressQuery(fields) && !!(fields.city || fields.postal_code),
    };
  });
}

const COMPARE_KEYS: (keyof ContactFields)[] = [
  'first_name', 'last_name', 'company', 'position', 'phone', 'mobile', 'email', 'website',
  'street', 'postal_code', 'city', 'country',
];

/** Felder, die sich gegenüber dem lokalen Stand geändert haben (nur nicht-leere Adressbuchwerte). */
export function changedFields(entry: AddressBookEntry, local: ContactWithCategories): (keyof ContactFields)[] {
  return COMPARE_KEYS.filter((k) => {
    const a = String(entry.fields[k] ?? '').trim();
    return a !== '' && a !== String(local[k] ?? '').trim();
  });
}

/**
 * Ordnet Adressbucheinträge den lokalen Kontakten zu:
 *  - new:       noch nicht vorhanden
 *  - changed:   bereits importiert (gleiche Adressbuch-ID), aber im Adressbuch geändert
 *  - same:      bereits importiert, unverändert
 *  - duplicate: gleicher Name + Telefon/E-Mail wie ein vorhandener Kontakt (z. B. gescannt)
 */
export function matchCandidates(entries: AddressBookEntry[], locals: ContactWithCategories[]): AddressBookCandidate[] {
  const byExternal = new Map(locals.filter((l) => l.external_id).map((l) => [l.external_id!, l]));
  return entries.map((e) => {
    const linked = byExternal.get(e.externalId);
    if (linked) {
      return { ...e, status: changedFields(e, linked).length ? 'changed' : 'same', localId: linked.id };
    }
    const dup = locals.find((l) =>
      isDuplicate(
        { first_name: l.first_name, last_name: l.last_name, phones: [l.phone, l.mobile], emails: [l.email] },
        { first_name: e.fields.first_name, last_name: e.fields.last_name, phones: e.phones, emails: e.emails },
      ),
    );
    if (dup) return { ...e, status: 'duplicate', localId: dup.id };
    return { ...e, status: 'new' };
  });
}
