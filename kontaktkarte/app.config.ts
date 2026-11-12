import type { ExpoConfig } from 'expo/config';

/**
 * Konfiguration der Kontaktkarte-App.
 *
 * Google-Maps-Schlüssel für Android (kostenlos für das Maps SDK for Android)
 * wird aus der Umgebungsvariable GOOGLE_MAPS_ANDROID_API_KEY gelesen und
 * landet nur in der lokal gebauten APK – nie im Repository.
 * iOS verwendet Apple Maps und braucht keinen Schlüssel.
 */
const config: ExpoConfig = {
  name: 'Kontaktkarte',
  slug: 'kontaktkarte',
  scheme: 'kontaktkarte',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'at.tibe.kontaktkarte',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'at.tibe.kontaktkarte',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Das Adressbuch wird nur gelesen – Schreibrechte & Mikrofon explizit sperren.
    blockedPermissions: [
      'android.permission.WRITE_CONTACTS',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    // Keine automatische Cloud-Sicherung der App-Daten durch Android.
    allowBackup: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        cameraPermission: 'Die Kamera wird benötigt, um Visitenkarten zu fotografieren.',
        photosPermission: 'Optional: Visitenkarten-Fotos aus der Mediathek wählen.',
        microphonePermission: false,
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission:
          'Kontakte werden nur gelesen, um sie in die Kontaktkarte zu übernehmen. Das Adressbuch wird nicht verändert.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Wird für die Umwandlung von Adressen in Kartenpositionen (Geocoding) verwendet.',
        motionUsagePermission: false,
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Face ID schützt deine Kontakte vor fremdem Zugriff.' },
    ],
    [
      'react-native-maps',
      { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    ],
  ],
  experiments: { typedRoutes: false },
};

export default config;
