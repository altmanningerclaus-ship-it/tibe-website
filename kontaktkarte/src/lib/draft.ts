import type { ContactFields } from '../db/types';

/**
 * Zwischenspeicher für einen gescannten Kontakt (Scanner → Formular).
 * Bleibt im Arbeitsspeicher, nichts verlässt das Gerät.
 */
export type ScanDraft = {
  fields: Partial<ContactFields>;
  frontUri?: string;
  backUri?: string;
  rawText?: string;
};

let draft: ScanDraft | null = null;

export function setDraft(d: ScanDraft) {
  draft = d;
}

export function peekDraft(): ScanDraft | null {
  return draft;
}

export function clearDraft() {
  draft = null;
}
