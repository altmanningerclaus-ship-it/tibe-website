import { Directory, File, Paths } from 'expo-file-system';

/** Visitenkarten-Fotos liegen im App-Dokumentenordner unter /photos. */
export function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function photoFile(fileName: string): File {
  return new File(photosDir(), fileName);
}

export function photoUri(fileName: string): string {
  return photoFile(fileName).uri;
}

/** Kopiert ein (temporäres) Kamerabild dauerhaft in den Fotoordner. */
export function storePhoto(sourceUri: string, contactId: string, side: 'front' | 'back'): string {
  const ext = (sourceUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const fileName = `${contactId}-${side}-${Date.now()}.${ext.length <= 4 ? ext : 'jpg'}`;
  const src = new File(sourceUri);
  src.copySync(photoFile(fileName));
  return fileName;
}

export function deletePhotoFile(fileName: string) {
  try {
    const f = photoFile(fileName);
    if (f.exists) f.delete();
  } catch {
    // Datei bereits weg – ignorieren.
  }
}
