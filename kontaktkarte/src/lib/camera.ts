import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/** Fotografiert eine Visitenkarte mit der System-Kamera (oder wählt ein Bild). */
export async function captureCard(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kamera nicht erlaubt', 'Bitte den Kamerazugriff in den Einstellungen erlauben.', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Einstellungen', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    exif: false,
  };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}
