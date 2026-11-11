import type { SQLiteDatabase } from 'expo-sqlite';

import { addressQuery, nowIso, uuid } from '../lib/contact-utils';
import { emitDataChanged } from '../lib/events';
import type {
  Category,
  Contact,
  ContactFields,
  ContactPhoto,
  ContactSource,
  ContactWithCategories,
} from './types';
import { FIELD_KEYS } from './types';

// ---------------------------------------------------------------- Kategorien

export function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY sort_order, name');
}

export async function createCategory(db: SQLiteDatabase, name: string, color: string) {
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories');
  const res = await db.runAsync(
    'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
    name.trim(),
    color,
    (max?.m ?? -1) + 1,
  );
  emitDataChanged();
  return res.lastInsertRowId;
}

export async function updateCategory(db: SQLiteDatabase, id: number, name: string, color: string) {
  await db.runAsync('UPDATE categories SET name = ?, color = ? WHERE id = ?', name.trim(), color, id);
  emitDataChanged();
}

export async function deleteCategory(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM contact_categories WHERE category_id = ?', id);
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
  emitDataChanged();
}

export async function countContactsInCategory(db: SQLiteDatabase, id: number): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM contact_categories WHERE category_id = ?',
    id,
  );
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- Kontakte

type ContactRow = Contact & { category_ids_csv: string | null };

const CONTACT_SELECT = `
  SELECT c.*,
    (SELECT GROUP_CONCAT(category_id) FROM
       (SELECT category_id FROM contact_categories cc
        WHERE cc.contact_id = c.id ORDER BY cc.position)) AS category_ids_csv
  FROM contacts c`;

function mapRow(r: ContactRow): ContactWithCategories {
  const { category_ids_csv, ...rest } = r;
  return {
    ...rest,
    category_ids: category_ids_csv ? category_ids_csv.split(',').map(Number) : [],
  };
}

export async function listContacts(db: SQLiteDatabase): Promise<ContactWithCategories[]> {
  const rows = await db.getAllAsync<ContactRow>(CONTACT_SELECT);
  return rows.map(mapRow);
}

export async function getContact(db: SQLiteDatabase, id: string): Promise<ContactWithCategories | null> {
  const r = await db.getFirstAsync<ContactRow>(`${CONTACT_SELECT} WHERE c.id = ?`, id);
  return r ? mapRow(r) : null;
}

export type SaveContactInput = {
  id?: string;
  fields: ContactFields;
  categoryIds: number[];
  source?: ContactSource;
  externalId?: string | null;
  /** Bei Massen-Import: keine Änderungs-Benachrichtigung pro Kontakt. */
  silent?: boolean;
};

/**
 * Legt einen Kontakt an oder aktualisiert ihn. Ändert sich die Adresse,
 * werden die Koordinaten verworfen und das Geocoding neu eingeplant.
 */
export async function saveContact(db: SQLiteDatabase, input: SaveContactInput): Promise<string> {
  const id = input.id ?? uuid();
  const now = nowIso();
  const query = addressQuery(input.fields);

  await db.withTransactionAsync(async () => {
    const existing = input.id
      ? await db.getFirstAsync<Contact>('SELECT * FROM contacts WHERE id = ?', input.id)
      : null;

    const values = FIELD_KEYS.map((k) => input.fields[k] ?? (k === 'met_on' ? null : ''));

    if (existing) {
      const addressChanged = existing.geo_query !== query;
      const sets = FIELD_KEYS.map((k) => `${k} = ?`).join(', ');
      await db.runAsync(
        `UPDATE contacts SET ${sets}, updated_at = ? WHERE id = ?`,
        ...values,
        now,
        id,
      );
      if (addressChanged) {
        await db.runAsync(
          `UPDATE contacts SET latitude = NULL, longitude = NULL, geo_query = ?, geo_status = ? WHERE id = ?`,
          query,
          query ? 'pending' : 'none',
          id,
        );
      }
      if (input.externalId !== undefined) {
        await db.runAsync('UPDATE contacts SET external_id = ? WHERE id = ?', input.externalId, id);
      }
    } else {
      const cols = [...FIELD_KEYS, 'id', 'geo_status', 'geo_query', 'source', 'external_id', 'created_at', 'updated_at'];
      await db.runAsync(
        `INSERT INTO contacts (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        ...values,
        id,
        query ? 'pending' : 'none',
        query,
        input.source ?? 'manual',
        input.externalId ?? null,
        now,
        now,
      );
    }

    await setContactCategoriesTx(db, id, input.categoryIds);
  });

  if (!input.silent) emitDataChanged();
  return id;
}

async function setContactCategoriesTx(db: SQLiteDatabase, contactId: string, ids: number[]) {
  await db.runAsync('DELETE FROM contact_categories WHERE contact_id = ?', contactId);
  for (const [i, catId] of ids.entries()) {
    await db.runAsync(
      'INSERT OR IGNORE INTO contact_categories (contact_id, category_id, position) VALUES (?, ?, ?)',
      contactId,
      catId,
      i,
    );
  }
}

export async function addCategoriesToContacts(db: SQLiteDatabase, contactIds: string[], categoryIds: number[]) {
  if (!categoryIds.length) return;
  await db.withTransactionAsync(async () => {
    for (const cid of contactIds) {
      const r = await db.getFirstAsync<{ m: number | null }>(
        'SELECT MAX(position) AS m FROM contact_categories WHERE contact_id = ?',
        cid,
      );
      let pos = (r?.m ?? -1) + 1;
      for (const cat of categoryIds) {
        const res = await db.runAsync(
          'INSERT OR IGNORE INTO contact_categories (contact_id, category_id, position) VALUES (?, ?, ?)',
          cid,
          cat,
          pos,
        );
        if (res.changes) pos++;
      }
    }
  });
  emitDataChanged();
}

export async function deleteContact(db: SQLiteDatabase, id: string): Promise<ContactPhoto[]> {
  const photos = await listPhotos(db, id);
  await db.runAsync('DELETE FROM contacts WHERE id = ?', id);
  emitDataChanged();
  return photos;
}

// ---------------------------------------------------------------- Geocoding

export function listPendingGeocodes(db: SQLiteDatabase, limit = 50) {
  return db.getAllAsync<Pick<Contact, 'id' | 'geo_query'>>(
    "SELECT id, geo_query FROM contacts WHERE geo_status = 'pending' AND geo_query <> '' ORDER BY updated_at DESC LIMIT ?",
    limit,
  );
}

export async function setGeocodeResult(
  db: SQLiteDatabase,
  id: string,
  forQuery: string,
  coords: { latitude: number; longitude: number } | null,
) {
  // Nur übernehmen, wenn die Adresse inzwischen nicht geändert wurde.
  await db.runAsync(
    `UPDATE contacts SET latitude = ?, longitude = ?, geo_status = ? WHERE id = ? AND geo_query = ?`,
    coords?.latitude ?? null,
    coords?.longitude ?? null,
    coords ? 'ok' : 'failed',
    id,
    forQuery,
  );
}

export async function setManualLocation(db: SQLiteDatabase, id: string, latitude: number, longitude: number) {
  await db.runAsync(
    "UPDATE contacts SET latitude = ?, longitude = ?, geo_status = 'manual', updated_at = ? WHERE id = ?",
    latitude,
    longitude,
    nowIso(),
    id,
  );
  emitDataChanged();
}

export async function retryFailedGeocodes(db: SQLiteDatabase): Promise<number> {
  const r = await db.runAsync(
    "UPDATE contacts SET geo_status = 'pending' WHERE geo_status = 'failed' AND geo_query <> ''",
  );
  emitDataChanged();
  return r.changes;
}

export async function geoStats(db: SQLiteDatabase) {
  return db.getAllAsync<{ geo_status: string; n: number }>(
    'SELECT geo_status, COUNT(*) AS n FROM contacts GROUP BY geo_status',
  );
}

// ---------------------------------------------------------------- Fotos

export function listPhotos(db: SQLiteDatabase, contactId: string) {
  return db.getAllAsync<ContactPhoto>(
    "SELECT * FROM contact_photos WHERE contact_id = ? ORDER BY CASE side WHEN 'front' THEN 0 ELSE 1 END",
    contactId,
  );
}

export function listAllPhotos(db: SQLiteDatabase) {
  return db.getAllAsync<ContactPhoto>('SELECT * FROM contact_photos');
}

export async function upsertPhoto(db: SQLiteDatabase, contactId: string, side: 'front' | 'back', fileName: string) {
  await db.runAsync(
    `INSERT INTO contact_photos (contact_id, side, file_name) VALUES (?, ?, ?)
     ON CONFLICT(contact_id, side) DO UPDATE SET file_name = excluded.file_name`,
    contactId,
    side,
    fileName,
  );
  emitDataChanged();
}

export async function deletePhotoRow(db: SQLiteDatabase, contactId: string, side: 'front' | 'back') {
  await db.runAsync('DELETE FROM contact_photos WHERE contact_id = ? AND side = ?', contactId, side);
  emitDataChanged();
}

// ---------------------------------------------------------------- Einstellungen

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
