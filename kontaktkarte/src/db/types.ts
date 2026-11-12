export type GeoStatus = 'none' | 'pending' | 'ok' | 'failed' | 'manual';
export type ContactSource = 'manual' | 'scan' | 'addressbook' | 'backup';

export type Category = {
  id: number;
  name: string;
  color: string;
  sort_order: number;
};

/** Bearbeitbare Kontaktfelder. */
export type ContactFields = {
  first_name: string;
  last_name: string;
  company: string;
  position: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  note: string;
  met_on: string | null;
  met_at: string;
};

export type Contact = ContactFields & {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geo_status: GeoStatus;
  geo_query: string;
  source: ContactSource;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Kontakt inkl. Kategorie-IDs (sortiert, erste = Hauptkategorie). */
export type ContactWithCategories = Contact & { category_ids: number[] };

export type ContactPhoto = {
  id: number;
  contact_id: string;
  side: 'front' | 'back';
  file_name: string;
};

export const EMPTY_FIELDS: ContactFields = {
  first_name: '',
  last_name: '',
  company: '',
  position: '',
  phone: '',
  mobile: '',
  email: '',
  website: '',
  street: '',
  postal_code: '',
  city: '',
  country: '',
  note: '',
  met_on: null,
  met_at: '',
};

export const FIELD_KEYS = Object.keys(EMPTY_FIELDS) as (keyof ContactFields)[];
