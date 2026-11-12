import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Datenbankschema (SQLite, lokal auf dem Gerät).
 *
 *  categories          – Kategorien mit Farbe & Reihenfolge
 *  contacts            – Kontaktdaten inkl. Koordinaten & Geocoding-Status
 *  contact_categories  – n:m-Zuordnung; position 0 = Hauptkategorie (Pin-Farbe)
 *  contact_photos      – Visitenkartenfotos (Dateiname im Dokumentenordner)
 *  settings            – Schlüssel/Wert-Einstellungen (z. B. App-Sperre)
 *
 * Migrationen laufen über PRAGMA user_version.
 */
export const DATABASE_NAME = 'kontaktkarte.db';

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE contacts (
    id            TEXT PRIMARY KEY,
    first_name    TEXT NOT NULL DEFAULT '',
    last_name     TEXT NOT NULL DEFAULT '',
    company       TEXT NOT NULL DEFAULT '',
    position      TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL DEFAULT '',
    mobile        TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    website       TEXT NOT NULL DEFAULT '',
    street        TEXT NOT NULL DEFAULT '',
    postal_code   TEXT NOT NULL DEFAULT '',
    city          TEXT NOT NULL DEFAULT '',
    country       TEXT NOT NULL DEFAULT '',
    note          TEXT NOT NULL DEFAULT '',
    met_on        TEXT,                -- ISO-Datum YYYY-MM-DD
    met_at        TEXT NOT NULL DEFAULT '',
    latitude      REAL,
    longitude     REAL,
    geo_status    TEXT NOT NULL DEFAULT 'none'
                  CHECK (geo_status IN ('none','pending','ok','failed','manual')),
    geo_query     TEXT NOT NULL DEFAULT '',  -- Adresse, für die Koordinaten gelten
    source        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','scan','addressbook','backup')),
    external_id   TEXT,                -- ID im System-Adressbuch (nur Abgleich)
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX idx_contacts_geo ON contacts(geo_status);
  CREATE INDEX idx_contacts_external ON contacts(external_id);

  CREATE TABLE contact_categories (
    contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contact_id, category_id)
  );
  CREATE INDEX idx_cc_category ON contact_categories(category_id);

  CREATE TABLE contact_photos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    side        TEXT NOT NULL CHECK (side IN ('front','back')),
    file_name   TEXT NOT NULL,
    UNIQUE (contact_id, side)
  );

  CREATE TABLE settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
  `,
];

export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'BNI-Kollegen', color: '#D32F2F' },
  { name: 'Geschäftskollegen', color: '#1976D2' },
  { name: 'Kunden', color: '#2E7D32' },
  { name: 'Lieferanten', color: '#F57C00' },
  { name: 'Freunde', color: '#7B1FA2' },
  { name: 'Verwandte', color: '#00838F' },
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      if (next === 1) {
        for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
          await db.runAsync(
            'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
            c.name,
            c.color,
            i,
          );
        }
      }
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
