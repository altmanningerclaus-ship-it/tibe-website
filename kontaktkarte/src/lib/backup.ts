import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import JSZip from 'jszip';

import { listAllPhotos, listCategories, listContacts } from '../db/repo';
import type { Category, Contact, ContactPhoto, ContactWithCategories } from '../db/types';
import { toIsoDate } from './contact-utils';
import { emitDataChanged } from './events';
import { toCsv, toVCard } from './formats';
import { photoFile, photosDir } from './photos';

export const BACKUP_FORMAT = 1;

export type BackupData = {
  app: 'kontaktkarte';
  format: number;
  exported_at: string;
  categories: Category[];
  contacts: ContactWithCategories[];
  photos: Pick<ContactPhoto, 'contact_id' | 'side' | 'file_name'>[];
};

const CONTACT_COLUMNS: (keyof Contact)[] = [
  'id', 'first_name', 'last_name', 'company', 'position', 'phone', 'mobile', 'email', 'website',
  'street', 'postal_code', 'city', 'country', 'note', 'met_on', 'met_at', 'latitude', 'longitude',
  'geo_status', 'geo_query', 'source', 'external_id', 'created_at', 'updated_at',
];

function exportFile(name: string): File {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  return f;
}

async function share(file: File, mimeType: string, uti?: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: 'Kontaktkarte exportieren' });
}

async function collect(db: SQLiteDatabase) {
  const [categories, contacts, photos] = await Promise.all([
    listCategories(db),
    listContacts(db),
    listAllPhotos(db),
  ]);
  return { categories, contacts, photos };
}

/** Vollständige Sicherung: data.json + Fotos + CSV + vCard in einer ZIP-Datei. */
export async function exportBackupZip(db: SQLiteDatabase, onStep?: (msg: string) => void): Promise<void> {
  onStep?.('Daten sammeln …');
  const { categories, contacts, photos } = await collect(db);
  const data: BackupData = {
    app: 'kontaktkarte',
    format: BACKUP_FORMAT,
    exported_at: new Date().toISOString(),
    categories,
    contacts,
    photos: photos.map(({ contact_id, side, file_name }) => ({ contact_id, side, file_name })),
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data, null, 2));
  zip.file('kontakte.csv', toCsv(contacts, categories));
  zip.file('kontakte.vcf', toVCard(contacts, categories));

  const folder = zip.folder('photos')!;
  for (const [i, p] of photos.entries()) {
    onStep?.(`Fotos packen … ${i + 1}/${photos.length}`);
    const f = photoFile(p.file_name);
    if (f.exists) folder.file(p.file_name, await f.bytes());
  }

  onStep?.('ZIP erstellen …');
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  const out = exportFile(`kontaktkarte-sicherung-${toIsoDate(new Date())}.zip`);
  out.write(bytes);
  onStep?.('Teilen …');
  await share(out, 'application/zip', 'public.zip-archive');
}

export async function exportCsv(db: SQLiteDatabase) {
  const { categories, contacts } = await collect(db);
  const out = exportFile(`kontakte-${toIsoDate(new Date())}.csv`);
  out.write(toCsv(contacts, categories));
  await share(out, 'text/csv', 'public.comma-separated-values-text');
}

export async function exportVCard(db: SQLiteDatabase) {
  const { categories, contacts } = await collect(db);
  const out = exportFile(`kontakte-${toIsoDate(new Date())}.vcf`);
  out.write(toVCard(contacts, categories));
  await share(out, 'text/vcard', 'public.vcard');
}

// ------------------------------------------------------------- Wiederherstellung

export type LoadedBackup = { data: BackupData; zip: JSZip; name: string };

export async function pickBackup(): Promise<LoadedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const bytes = await new File(asset.uri).bytes();
  const zip = await JSZip.loadAsync(bytes);
  const json = zip.file('data.json');
  if (!json) throw new Error('Die Datei enthält keine Kontaktkarte-Sicherung (data.json fehlt).');
  const data = JSON.parse(await json.async('string')) as BackupData;
  if (data.app !== 'kontaktkarte' || !Array.isArray(data.contacts) || !Array.isArray(data.categories)) {
    throw new Error('Ungültiges Sicherungsformat.');
  }
  if (data.format > BACKUP_FORMAT) {
    throw new Error('Diese Sicherung stammt von einer neueren App-Version.');
  }
  return { data, zip, name: asset.name };
}

export type RestoreMode = 'replace' | 'merge';
export type RestoreResult = { added: number; updated: number; skipped: number; photos: number };

async function insertOrReplaceContact(db: SQLiteDatabase, c: Contact) {
  const values = CONTACT_COLUMNS.map((k) => (c[k] === undefined ? null : c[k]));
  await db.runAsync(
    `INSERT OR REPLACE INTO contacts (${CONTACT_COLUMNS.join(', ')}) VALUES (${CONTACT_COLUMNS.map(() => '?').join(', ')})`,
    ...(values as (string | number | null)[]),
  );
}

/**
 * replace: Alle lokalen Daten werden durch die Sicherung ersetzt.
 * merge:   Fehlende Kontakte werden ergänzt, neuere Stände überschreiben ältere;
 *          Kategorien werden über den Namen zugeordnet.
 */
export async function restoreBackup(
  db: SQLiteDatabase,
  { data, zip }: LoadedBackup,
  mode: RestoreMode,
  onStep?: (msg: string) => void,
): Promise<RestoreResult> {
  const result: RestoreResult = { added: 0, updated: 0, skipped: 0, photos: 0 };
  const writtenPhotos: string[] = [];

  // Fotos zuerst entpacken (außerhalb der Transaktion, Dateisystem).
  const photoNames = new Set(data.photos.map((p) => p.file_name));
  let i = 0;
  for (const name of photoNames) {
    i++;
    onStep?.(`Fotos entpacken … ${i}/${photoNames.size}`);
    const entry = zip.file(`photos/${name}`);
    if (!entry || name.includes('/') || name.includes('..')) continue;
    const target = photoFile(name);
    if (mode === 'merge' && target.exists) continue;
    target.write(await entry.async('uint8array'));
    writtenPhotos.push(name);
  }
  result.photos = writtenPhotos.length;

  onStep?.('Datenbank schreiben …');
  let oldPhotoFiles: string[] = [];

  await db.withTransactionAsync(async () => {
    const categoryMap = new Map<number, number>();

    if (mode === 'replace') {
      oldPhotoFiles = (await listAllPhotos(db)).map((p) => p.file_name);
      await db.execAsync('DELETE FROM contact_photos; DELETE FROM contact_categories; DELETE FROM contacts; DELETE FROM categories;');
      for (const c of data.categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)',
          c.id, c.name, c.color, c.sort_order,
        );
        categoryMap.set(c.id, c.id);
      }
    } else {
      const local = await listCategories(db);
      const byName = new Map(local.map((c) => [c.name.toLocaleLowerCase('de'), c.id]));
      let order = local.length;
      for (const c of data.categories) {
        const existing = byName.get(c.name.toLocaleLowerCase('de'));
        if (existing != null) {
          categoryMap.set(c.id, existing);
        } else {
          const r = await db.runAsync(
            'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
            c.name, c.color, order++,
          );
          categoryMap.set(c.id, r.lastInsertRowId);
        }
      }
    }

    for (const c of data.contacts) {
      const { category_ids, ...contact } = c;
      if (mode === 'merge') {
        const existing = await db.getFirstAsync<{ updated_at: string }>(
          'SELECT updated_at FROM contacts WHERE id = ?', contact.id,
        );
        if (existing && existing.updated_at >= contact.updated_at) {
          result.skipped++;
          continue;
        }
        if (existing) result.updated++;
        else result.added++;
      } else {
        result.added++;
      }
      await insertOrReplaceContact(db, contact);
      await db.runAsync('DELETE FROM contact_categories WHERE contact_id = ?', contact.id);
      for (const [pos, oldId] of (category_ids ?? []).entries()) {
        const newId = categoryMap.get(oldId);
        if (newId == null) continue;
        await db.runAsync(
          'INSERT OR IGNORE INTO contact_categories (contact_id, category_id, position) VALUES (?, ?, ?)',
          contact.id, newId, pos,
        );
      }
    }

    for (const p of data.photos) {
      if (!photoFile(p.file_name).exists) continue;
      await db.runAsync(
        `INSERT INTO contact_photos (contact_id, side, file_name)
         SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM contacts WHERE id = ?)
         ON CONFLICT(contact_id, side) DO UPDATE SET file_name = excluded.file_name`,
        p.contact_id, p.side, p.file_name, p.contact_id,
      );
    }
  });

  // Nicht mehr referenzierte Fotodateien aufräumen.
  if (mode === 'replace') {
    const keep = new Set(data.photos.map((p) => p.file_name));
    for (const name of oldPhotoFiles) {
      if (!keep.has(name)) {
        const f = photoFile(name);
        if (f.exists) f.delete();
      }
    }
  }
  photosDir();
  emitDataChanged();
  return result;
}
