import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  inputBg: string;
};

const light: Theme = {
  dark: false,
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#15181D',
  muted: '#6B7280',
  border: '#E1E4E8',
  primary: '#1F5FBF',
  primaryText: '#FFFFFF',
  danger: '#C62828',
  inputBg: '#FFFFFF',
};

const dark: Theme = {
  dark: true,
  bg: '#0E1013',
  card: '#1A1D22',
  text: '#ECEEF1',
  muted: '#9AA1AC',
  border: '#2C3036',
  primary: '#5B9BFF',
  primaryText: '#0E1013',
  danger: '#FF6B6B',
  inputBg: '#22262C',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Gut unterscheidbare Farben für Kategorien (auch auf Karte und im Dunkelmodus). */
export const CATEGORY_PALETTE = [
  '#D32F2F', // Rot
  '#1976D2', // Blau
  '#2E7D32', // Grün
  '#F57C00', // Orange
  '#7B1FA2', // Violett
  '#C2185B', // Pink
  '#00838F', // Petrol
  '#FBC02D', // Gelb
  '#5D4037', // Braun
  '#455A64', // Schiefer
  '#7CB342', // Hellgrün
  '#3949AB', // Indigo
  '#E64A19', // Ziegel
  '#00ACC1', // Cyan
  '#8E24AA', // Lila
  '#000000', // Schwarz
] as const;

/** Lesbare Textfarbe (schwarz/weiß) auf einem Hintergrund. */
export function textOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#FFFFFF';
}
