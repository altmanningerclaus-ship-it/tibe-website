# Kontaktkarte

Private Visitenkarten- & Kontakt-App mit Weltkarte – **nur für das eigene Handy**.
Kein Server, keine Cloud, kein Backend, kein Tracking. Alle Daten bleiben lokal.

Expo SDK 58 · React Native · TypeScript · Development Build (nicht Expo Go).

## Funktionen

| Bereich | Umsetzung |
|---|---|
| Visitenkarte scannen | System-Kamera (Vorder- + optional Rückseite), OCR **on-device** über `expo-text-extractor` (Android: Google ML Kit, iOS: Apple Vision), Feldvorschläge aus `src/lib/card-parser.ts`, Prüfen/Korrigieren vor dem Speichern |
| Kategorien | 6 Standardkategorien mit eigenen Farben, eigene anlegen/umbenennen/umfärben/löschen, Mehrfachzuordnung, erste = Hauptkategorie (Pin-Farbe) |
| Weltkarte | `react-native-maps` (Apple Maps / Google Maps), farbige Pins, Clustering (`supercluster`), Filter-Chips + „Alle“, Suche mit Sprung zum Treffer, Kurzkarte → Details, Legende |
| Adressbuch | `expo-contacts` **nur lesend**, Auswahl mit Häkchen, Kategorie für Mehrfachauswahl, Duplikaterkennung (Name + Telefon/E-Mail), „Neu abgleichen“ erkennt geänderte Einträge |
| Liste & Details | Suche, Kategorie-Filter, Sortierung Name/Firma/Ort; Anruf, E-Mail, Navigation, Website; Bearbeiten, Löschen, manuell anlegen |
| Geocoding | `expo-location` `geocodeAsync` (Systemdienst), Koordinaten werden gespeichert; ohne Internet bleibt der Kontakt „ohne Standort“ und wird später automatisch nachgeholt |
| Datensicherung | ZIP mit `data.json` + Fotos + `kontakte.csv` + `kontakte.vcf` über das Teilen-Menü; Wiederherstellen per „Zusammenführen“ oder „Alles ersetzen“ |
| Datenschutz | Optionale App-Sperre (Face ID / Fingerabdruck, Geräte-Code als Ausweich), Android-Auto-Backup aus, Schreibrechte aufs Adressbuch und Mikrofon blockiert |
| Oberfläche | Deutsch, Tabs Karte · Liste · **Scannen** · Einstellungen, Hell-/Dunkelmodus |

## Projektstruktur

```
kontaktkarte/
├── app.config.ts              App-Konfiguration, Berechtigungstexte, Config-Plugins
├── eas.json                   Build-Profile (APK / iOS intern)
└── src/
    ├── app/                   Bildschirme (Expo Router, dateibasiert)
    │   ├── _layout.tsx        SQLite-Provider, App-Sperre, Hintergrund-Geocoding
    │   ├── (tabs)/
    │   │   ├── index.tsx      Karte
    │   │   ├── liste.tsx      Liste
    │   │   ├── scannen.tsx    Scanner
    │   │   └── einstellungen.tsx
    │   ├── kontakt/[id].tsx   Detailansicht
    │   ├── kontakt/bearbeiten.tsx  Neu / Bearbeiten / Scan prüfen
    │   ├── kategorien.tsx
    │   ├── adressbuch.tsx     Import & Abgleich
    │   └── sicherung.tsx      Export & Wiederherstellung
    ├── db/
    │   ├── schema.ts          Tabellen + Migrationen (PRAGMA user_version)
    │   ├── repo.ts            alle SQL-Zugriffe
    │   └── types.ts
    ├── lib/
    │   ├── card-parser.ts     OCR-Text → Felder (+ Tests)
    │   ├── geocoding.ts       Warteschlange, Drosselung, Offline-Erkennung
    │   ├── addressbook.ts     Lesen + Abgleich + Duplikate
    │   ├── backup.ts          ZIP-Export/-Import
    │   ├── formats.ts         CSV / vCard
    │   ├── photos.ts          Fotos im Dokumentenordner
    │   └── …
    ├── components/            UI-Bausteine, Kategorie-Auswahl, Sperre
    └── hooks/data.ts          Daten-Hooks mit automatischem Neuladen
```

## Datenbankschema (SQLite)

```sql
categories          (id PK, name UNIQUE, color, sort_order, created_at)
contacts            (id TEXT PK /* UUID */, first_name, last_name, company, position,
                     phone, mobile, email, website, street, postal_code, city, country,
                     note, met_on /* YYYY-MM-DD */, met_at,
                     latitude, longitude,
                     geo_status  -- none | pending | ok | failed | manual
                     geo_query   -- Adresse, für die die Koordinaten gelten
                     source      -- manual | scan | addressbook | backup
                     external_id -- ID im System-Adressbuch (für „Neu abgleichen“)
                     created_at, updated_at)
contact_categories  (contact_id → contacts, category_id → categories,
                     position /* 0 = Hauptkategorie */, PK(contact_id, category_id))
contact_photos      (id PK, contact_id → contacts, side front|back, file_name,
                     UNIQUE(contact_id, side))
settings            (key PK, value)          -- z. B. app_lock = 1
```

Ändert sich die Adresse eines Kontakts, werden die Koordinaten verworfen und
das Geocoding neu eingeplant (`geo_query` ≠ aktuelle Adresse).

## Entwicklung

```bash
cd kontaktkarte
npm install
npm run typecheck && npm run lint && npm test
```

Wegen der nativen Module (OCR, Karten, SQLite …) läuft die App **nicht in Expo
Go**, sondern als eigener Build (siehe unten). Für die Entwicklung mit
Live-Reload: `npm run android` bzw. `npm run ios` (baut lokal einen
Development Build) und danach `npm start`.

## Google-Maps-Schlüssel (nur Android)

Android zeigt Google Maps an und braucht dafür einen (kostenlosen) API-Schlüssel
für das **Maps SDK for Android**:

1. <https://console.cloud.google.com/> → Projekt anlegen → „Maps SDK for Android“ aktivieren.
2. Anmeldedaten → API-Schlüssel erstellen, auf *Android-Apps* mit Paketname
   `at.tibe.kontaktkarte` + SHA-1 des Signaturzertifikats beschränken.
3. Schlüssel nur als Umgebungsvariable übergeben (nicht committen):
   `GOOGLE_MAPS_ANDROID_API_KEY=… ` bzw. bei EAS als Secret
   (`npx eas-cli env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value … --visibility sensitive`).

iOS verwendet Apple Maps und braucht keinen Schlüssel.

## Auf das eigene Handy bringen

### Android – APK (am einfachsten)

**Variante A – Cloud-Build mit EAS (kein Android Studio nötig):**

```bash
npm install -g eas-cli          # oder jeweils npx eas-cli@latest …
eas login                       # kostenloses Expo-Konto
eas init                        # verknüpft das Projekt
eas build -p android --profile preview
```

Am Ende erscheint ein Link/QR-Code zur `.apk`. Auf dem Handy öffnen,
„Installation aus unbekannten Quellen“ für den Browser/Dateimanager erlauben,
installieren. Alternativ APK per USB kopieren oder `adb install kontaktkarte.apk`.

**Variante B – lokal bauen (Android Studio + JDK 17 installiert):**

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

### iOS – ohne App Store

iOS erlaubt Installation nur mit Apple-Signatur. Zwei Wege:

**Variante A – kostenlose Apple-ID + Mac mit Xcode (Ad-hoc für 7 Tage):**

```bash
npx expo run:ios --device --configuration Release
```

iPhone per Kabel anschließen, in Xcode unter *Signing & Capabilities* das eigene
„Personal Team“ wählen. Auf dem iPhone: *Einstellungen → Allgemein → VPN &
Geräteverwaltung* → Entwickler vertrauen, außerdem *Datenschutz & Sicherheit →
Entwicklermodus* einschalten. Mit kostenlosem Konto läuft das Zertifikat nach
7 Tagen ab → dann erneut installieren (Daten bleiben erhalten).

**Variante B – Apple Developer Program (99 €/Jahr), ohne eigenen Mac:**

```bash
eas device:create                       # iPhone registrieren (Profil per QR-Code installieren)
eas build -p ios --profile preview      # interne Verteilung (Ad-hoc), 1 Jahr gültig
```

Den Link aus dem Build auf dem iPhone öffnen und installieren (Entwicklermodus
einschalten, s. o.).

> Tipp: Vor jedem Neuinstallieren bzw. Gerätewechsel unter **Einstellungen →
> Datensicherung** eine ZIP-Sicherung erstellen.

## Netzwerkzugriffe

Die App selbst ruft keine Server auf. Netzwerkverkehr entsteht nur durch
- Kartenkacheln (Apple Maps bzw. Google Maps SDK) und
- die Adress-Suche des Betriebssystems (`CLGeocoder` / Android `Geocoder`).

OCR, Datenbank, Fotos und Sicherungen bleiben vollständig auf dem Gerät.
Der Development Client (`expo-dev-client`) verbindet sich nur im
Entwicklungsmodus mit dem eigenen Rechner; der Release-Build enthält ihn nicht
aktiv.
