/**
 * Wandelt OCR-Text einer Visitenkarte in Feldvorschläge um.
 * Reine Heuristik ohne Netzwerk – das Ergebnis wird vor dem Speichern
 * immer vom Benutzer geprüft.
 */
export type ParsedCard = {
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
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:at|de|ch|com|net|org|eu|info|biz|io|co|it|li|cz|hu|si|sk|pl|nl|fr|uk|us)(?:\/[^\s]*)?)\b/i;
const PHONE_RE = /(\+|00|\(0|0)[\d\s/().-]{6,}\d/;

const LEGAL_FORMS =
  /(\b(gmbh|ag|kg|og|ges\.?m\.?b\.?h|mbh|ltd|inc|llc|gbr|ug|s\.?r\.?l|co\.?\s?kg)\b|\be\.\s?u\.|\bsp\.? z o\.?o)/i;
const COMPANY_HINTS =
  /\b(gmbh|ag|kg|og|ges\.?m\.?b\.?h|mbh|ltd|inc|llc|gbr|ug|s\.?r\.?l|co\.?\s?kg|holding|group|gruppe|consulting|solutions|services|werke?|bau|systems?|immobilien|versicherung|bank|kanzlei|steuerberatung|agentur|studio|verlag)\b/i;

const POSITION_HINTS =
  /\b(geschäftsführer(in)?|gf|ceo|cto|cfo|coo|inhaber(in)?|gründer(in)?|founder|co-?founder|owner|partner(in)?|prokurist(in)?|direktor(in)?|director|manager(in)?|head of|leiter(in)?|leitung|teamleiter(in)?|bereichsleiter(in)?|abteilungsleiter(in)?|berater(in)?|consultant|vertrieb|sales|verkauf|key account|account manager|marketing|einkauf|projektleiter(in)?|ingenieur(in)?|engineer|architekt(in)?|entwickler(in)?|developer|assistent(in)?|assistant|sekretariat|referent(in)?|sachbearbeiter(in)?|steuerberater(in)?|rechtsanwalt|rechtsanwältin|anwalt|notar(in)?|arzt|ärztin|coach|trainer(in)?|vorstand|präsident(in)?|president|vice president|vp|officer|spezialist(in)?|specialist|techniker(in)?|meister(in)?|makler(in)?|agent|betreuer(in)?|kundenbetreuer(in)?|mitarbeiter(in)?)\b/i;

const ACADEMIC_TITLES =
  /\b(dr|mag|ing|di|dipl|dkfm|prof|ba|ma|bsc|msc|mba|ll\.?m|med|phil|rer|nat|techn|univ|fh|ma|mas|bed|med\.?\s?univ|kr|komm\.?\s?rat)\b\.?(\s*\(fh\))?/gi;

const STREET_HINTS =
  /(straße|strasse|str\.|gasse|weg|platz|allee|ring|gürtel|kai|ufer|zeile|markt|steig|damm|hof|park|berg|feld|siedlung|promenade|chaussee|road|street|st\.|avenue|ave\.|lane)\b/i;

const COUNTRY_NAMES: [RegExp, string][] = [
  [/\b(österreich|oesterreich|austria)\b/i, 'Österreich'],
  [/\b(deutschland|germany)\b/i, 'Deutschland'],
  [/\b(schweiz|switzerland|suisse|svizzera)\b/i, 'Schweiz'],
  [/\b(liechtenstein)\b/i, 'Liechtenstein'],
  [/\b(italien|italy|italia)\b/i, 'Italien'],
];

const PLZ_RE = /(?:^|[\s,])(?:(A|AT|D|DE|CH|FL|I|IT)\s?[-–]\s?)?(\d{4,5})\s+([A-ZÄÖÜa-zäöüß][\wÄÖÜäöüß.\-/ ]{1,40})$/;

function clean(line: string): string {
  return line.replace(/[|•·]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripLabel(s: string): string {
  return s
    .replace(/^(tel(efon)?|phone|fon|t|mobil(e)?|mob|handy|cell|m|fax|f|e-?mail|mail|e|web|w|internet)\s*[.:]\s*/i, '')
    .trim();
}

function formatPhone(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim();
}

function isMobileNumber(num: string): boolean {
  const d = num.replace(/\(0\)/g, '').replace(/[^\d+]/g, '').replace(/^00/, '+');
  return (
    /^(\+43|0)6[5-9]/.test(d) || // Österreich
    /^(\+49|0)1[5-7]/.test(d) || // Deutschland
    /^(\+41|0)7[5-9]/.test(d) // Schweiz
  );
}

function countryFromPrefix(prefix: string | undefined, plz: string): string {
  switch ((prefix ?? '').toUpperCase()) {
    case 'A':
    case 'AT':
      return 'Österreich';
    case 'D':
    case 'DE':
      return 'Deutschland';
    case 'CH':
      return 'Schweiz';
    case 'FL':
      return 'Liechtenstein';
    case 'I':
    case 'IT':
      return 'Italien';
  }
  return plz.length === 5 ? 'Deutschland' : '';
}

function titleCaseWord(w: string): string {
  if (w.length <= 1) return w.toUpperCase();
  if (w === w.toUpperCase()) return w.charAt(0) + w.slice(1).toLowerCase();
  return w;
}

function looksLikeName(line: string): boolean {
  const withoutTitles = line.replace(ACADEMIC_TITLES, ' ').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\d|@/.test(withoutTitles)) return false;
  const words = withoutTitles.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-ZÄÖÜ][a-zäöüßéèáàíóúç'-]*$|^[A-ZÄÖÜ'-]{2,}$/.test(w) || /^(von|van|de|der|zu|di|da|du|del|le|la)$/i.test(w));
}

function splitName(line: string): { first: string; last: string } {
  const words = line
    .replace(ACADEMIC_TITLES, ' ')
    .replace(/[,]/g, ' ')
    .replace(/\s+\.\s*/g, ' ')
    .split(' ')
    .map((w) => w.replace(/\.$/, ''))
    .filter((w) => w.length > 0)
    .map(titleCaseWord);
  if (words.length <= 1) return { first: '', last: words[0] ?? '' };
  // Nachnamenspräfixe wie „von“ gehören zum Nachnamen.
  let splitAt = 1;
  for (let i = 1; i < words.length - 1; i++) {
    if (/^(von|van|de|der|zu|di|da|du|del|le|la)$/i.test(words[i])) {
      splitAt = i;
      break;
    }
    splitAt = i + 1 < words.length ? i : splitAt;
  }
  splitAt = Math.min(splitAt, words.length - 1);
  if (!words.slice(1, -1).some((w) => /^(von|van|de|der|zu|di|da|du|del|le|la)$/i.test(w))) {
    splitAt = words.length - 1; // Vor- und ggf. Zweitname, letzter = Nachname
  }
  return { first: words.slice(0, splitAt).join(' '), last: words.slice(splitAt).join(' ') };
}

export function parseCardText(blocks: string[]): ParsedCard {
  const out: ParsedCard = {
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
  };

  const lines = blocks
    .flatMap((b) => b.split(/\r?\n/))
    .map(clean)
    .filter((l) => l.length > 1);

  const used = new Set<number>();

  // 1) E-Mail
  lines.forEach((l, i) => {
    const m = l.match(EMAIL_RE);
    if (m && !out.email) {
      out.email = m[0].toLowerCase();
      if (stripLabel(l).replace(m[0], '').trim().length < 3) used.add(i);
    }
  });

  // 2) Telefonnummern (Fax ignorieren)
  lines.forEach((l, i) => {
    if (/@/.test(l)) return;
    // Mehrere Nummern pro Zeile möglich („T 01/234 M 0664/…“)
    const parts = l.split(/(?=\b(?:tel|phone|fon|mobil|mob|handy|cell|fax|t|m|f)\s*[.:])/i);
    let foundAny = false;
    for (const part of parts) {
      const m = part.match(PHONE_RE);
      if (!m) continue;
      const digits = m[0].replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 16) continue;
      if (/^\s*(\d{4,5})\s+[A-Za-zÄÖÜäöü]/.test(part) && !/^\s*(\+|0)/.test(part)) continue; // PLZ-Zeile
      foundAny = true;
      const label = part.slice(0, m.index ?? 0).toLowerCase();
      if (/fax|\bf\s*[.:]/.test(label)) continue;
      const num = formatPhone(m[0]);
      const mobileLabel = /mobil|mob|handy|cell|\bm\s*[.:]/.test(label);
      const phoneLabel = /tel|phone|fon|\bt\s*[.:]/.test(label);
      if ((mobileLabel || (!phoneLabel && isMobileNumber(num))) && !out.mobile) out.mobile = num;
      else if (!out.phone) out.phone = num;
      else if (!out.mobile) out.mobile = num;
    }
    if (foundAny) used.add(i);
  });

  // 3) Website
  lines.forEach((l, i) => {
    if (out.website || /@/.test(l)) return;
    const m = stripLabel(l).match(URL_RE);
    if (m && (/www\.|https?:|^web|^w\s*[.:]|^internet/i.test(l) || stripLabel(l) === m[0])) {
      out.website = m[0].replace(/^https?:\/\//i, '').replace(/\/$/, '');
      used.add(i);
    }
  });
  if (!out.website && out.email) {
    const domain = out.email.split('@')[1];
    if (domain && !/^(gmail|gmx|yahoo|hotmail|outlook|icloud|me|aon|chello|a1|web|t-online|live|mail|protonmail|posteo)\./i.test(domain)) {
      out.website = `www.${domain}`;
    }
  }

  // 4) PLZ + Ort, Land
  lines.forEach((l, i) => {
    if (used.has(i) || out.postal_code) return;
    const m = l.match(PLZ_RE);
    if (!m) return;
    const before = l.slice(0, m.index ?? 0).replace(/,\s*$/, '').trim();
    out.postal_code = m[2];
    let city = m[3].trim();
    for (const [re, name] of COUNTRY_NAMES) {
      if (re.test(city)) {
        out.country = name;
        city = city.replace(re, '').replace(/[,\s-]+$/, '').trim();
      }
    }
    out.city = city;
    if (!out.country) out.country = countryFromPrefix(m[1], m[2]);
    used.add(i);
    // Straße in derselben Zeile („Hauptstraße 1, 1010 Wien“)?
    if (before && /\d/.test(before)) {
      out.street = before;
    } else if (i > 0 && !used.has(i - 1) && /\d/.test(lines[i - 1]) && !PHONE_RE.test(lines[i - 1])) {
      out.street = lines[i - 1];
      used.add(i - 1);
    }
  });
  lines.forEach((l, i) => {
    if (used.has(i)) return;
    for (const [re, name] of COUNTRY_NAMES) {
      if (re.test(l) && l.length < 25) {
        out.country = out.country || name;
        used.add(i);
      }
    }
  });

  // 5) Straße (falls nicht neben PLZ gefunden)
  if (!out.street) {
    lines.forEach((l, i) => {
      if (out.street || used.has(i)) return;
      if (STREET_HINTS.test(l) && /\d/.test(l) && l.length < 60) {
        out.street = l;
        used.add(i);
      }
    });
  }

  // 6) Firma / Position / Name aus den restlichen Zeilen
  const rest = lines.map((l, i) => ({ l, i })).filter(({ i }) => !used.has(i));

  const companyLine =
    rest.find(({ l }) => LEGAL_FORMS.test(l)) ??
    rest.find(({ l }) => COMPANY_HINTS.test(l) && !POSITION_HINTS.test(l));
  if (companyLine) {
    out.company = companyLine.l;
    used.add(companyLine.i);
  }

  const positionLine = rest.find(({ l, i }) => !used.has(i) && POSITION_HINTS.test(l) && l.length < 70);
  if (positionLine) {
    out.position = positionLine.l;
    used.add(positionLine.i);
  }

  const nameLine =
    rest.find(({ l, i }) => !used.has(i) && looksLikeName(l) && !COMPANY_HINTS.test(l) && !POSITION_HINTS.test(l)) ??
    null;
  if (nameLine) {
    const { first, last } = splitName(nameLine.l);
    out.first_name = first;
    out.last_name = last;
    used.add(nameLine.i);
    // Position steht oft direkt unter dem Namen
    if (!out.position) {
      const next = lines[nameLine.i + 1];
      if (next && !used.has(nameLine.i + 1) && !/\d|@/.test(next) && next.length < 50 && !COMPANY_HINTS.test(next)) {
        out.position = next;
        used.add(nameLine.i + 1);
      }
    }
  }

  // Firma: erste übrige, auffällige Zeile (z. B. Logo-Schriftzug in Großbuchstaben)
  if (!out.company) {
    const candidate = rest.find(
      ({ l, i }) => !used.has(i) && !/@/.test(l) && !PHONE_RE.test(l) && l.length >= 2 && l.length < 50,
    );
    if (candidate) {
      out.company = candidate.l;
      used.add(candidate.i);
    }
  }

  return out;
}
