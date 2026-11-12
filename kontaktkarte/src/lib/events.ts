import { useEffect, useState } from 'react';

/** Minimaler Änderungs-Zähler, damit Bildschirme nach Schreibzugriffen neu laden. */
let version = 0;
const listeners = new Set<(v: number) => void>();

export function emitDataChanged() {
  version++;
  listeners.forEach((l) => l(version));
}

export function useDataVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
