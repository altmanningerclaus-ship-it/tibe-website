import type { Category, ContactWithCategories } from '../db/types';

/** CSV mit Semikolon + BOM, damit Excel (de) Umlaute und Spalten korrekt erkennt. */
export function toCsv(contacts: ContactWithCategories[], categories: Category[]): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const header = [
    'Vorname', 'Nachname', 'Firma', 'Position', 'Telefon', 'Mobil', 'E-Mail', 'Website',
    'Straße', 'PLZ', 'Ort', 'Land', 'Kategorien', 'Notiz', 'Kennengelernt am', 'Kennengelernt in',
    'Breitengrad', 'Längengrad',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = contacts.map((c) =>
    [
      c.first_name, c.last_name, c.company, c.position, c.phone, c.mobile, c.email, c.website,
      c.street, c.postal_code, c.city, c.country,
      c.category_ids.map((id) => catName.get(id) ?? '').filter(Boolean).join(', '),
      c.note, c.met_on ?? '', c.met_at, c.latitude ?? '', c.longitude ?? '',
    ].map(esc).join(';'),
  );
  return '\uFEFF' + [header.join(';'), ...rows].join('\r\n') + '\r\n';
}

function vEsc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/** vCard 3.0 – lässt sich in Adressbücher (iOS, Android, Outlook) importieren. */
export function toVCard(contacts: ContactWithCategories[], categories: Category[]): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return contacts
    .map((c) => {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      lines.push(`N:${vEsc(c.last_name)};${vEsc(c.first_name)};;;`);
      lines.push(`FN:${vEsc(`${c.first_name} ${c.last_name}`.trim() || c.company || 'Ohne Namen')}`);
      if (c.company) lines.push(`ORG:${vEsc(c.company)}`);
      if (c.position) lines.push(`TITLE:${vEsc(c.position)}`);
      if (c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${vEsc(c.phone)}`);
      if (c.mobile) lines.push(`TEL;TYPE=CELL:${vEsc(c.mobile)}`);
      if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(c.email)}`);
      if (c.website) lines.push(`URL:${vEsc(c.website)}`);
      if (c.street || c.city || c.postal_code || c.country) {
        lines.push(`ADR;TYPE=WORK:;;${vEsc(c.street)};${vEsc(c.city)};;${vEsc(c.postal_code)};${vEsc(c.country)}`);
      }
      if (c.latitude != null && c.longitude != null) lines.push(`GEO:${c.latitude};${c.longitude}`);
      const cats = c.category_ids.map((id) => catName.get(id)).filter(Boolean) as string[];
      if (cats.length) lines.push(`CATEGORIES:${cats.map(vEsc).join(',')}`);
      const note = [c.note, c.met_on ? `Kennengelernt am ${c.met_on}` : '', c.met_at ? `in ${c.met_at}` : '']
        .filter(Boolean)
        .join(' – ');
      if (note) lines.push(`NOTE:${vEsc(note)}`);
      lines.push(`REV:${c.updated_at}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    })
    .join('\r\n') + '\r\n';
}
