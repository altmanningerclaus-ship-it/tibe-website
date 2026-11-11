import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getContact, listCategories, listContacts, listPhotos } from '../db/repo';
import type { Category, ContactPhoto, ContactWithCategories } from '../db/types';
import { useDataVersion } from '../lib/events';

/** Lädt Daten asynchron und erneut nach jeder Änderung an der Datenbank. */
function useLoader<T>(load: () => Promise<T>, initial: T) {
  const version = useDataVersion();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch((e) => console.warn(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, version]);
  return { data, loading };
}

const NO_CATEGORIES: Category[] = [];
const NO_CONTACTS: ContactWithCategories[] = [];
const NO_CONTACT = { contact: null as ContactWithCategories | null, photos: [] as ContactPhoto[] };

export function useCategories() {
  const db = useSQLiteContext();
  const load = useCallback(() => listCategories(db), [db]);
  const { data } = useLoader(load, NO_CATEGORIES);
  const byId = useMemo(() => new Map(data.map((c) => [c.id, c])), [data]);
  return { categories: data, byId };
}

export function useContacts() {
  const db = useSQLiteContext();
  const load = useCallback(() => listContacts(db), [db]);
  const { data, loading } = useLoader(load, NO_CONTACTS);
  return { contacts: data, loading };
}

export function useContact(id: string | undefined) {
  const db = useSQLiteContext();
  const load = useCallback(async () => {
    if (!id) return NO_CONTACT;
    const [contact, photos] = await Promise.all([getContact(db, id), listPhotos(db, id)]);
    return { contact, photos };
  }, [db, id]);
  const { data, loading } = useLoader(load, NO_CONTACT);
  return { ...data, loading };
}

/** Farbe der Hauptkategorie (erste zugeordnete Kategorie). */
export function mainColor(c: ContactWithCategories, byId: Map<number, Category>, fallback = '#808080') {
  for (const id of c.category_ids) {
    const cat = byId.get(id);
    if (cat) return cat.color;
  }
  return fallback;
}
